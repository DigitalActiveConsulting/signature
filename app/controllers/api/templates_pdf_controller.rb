# frozen_string_literal: true

module Api
  class TemplatesPdfController < ApiBaseController
    PDF_CONTENT_TYPE = Templates::CreateAttachments::PDF_CONTENT_TYPE
    URL_REGEXP = %r{\Ahttps?://}i
    BASE64_PREFIX_REGEXP = /\Adata:[^,]*;base64,/

    def create
      Params::TemplatePdfCreateValidator.call(params)

      @template = Template.new(account: current_account, author: current_user, source: :api,
                               external_id: params[:external_id].presence,
                               shared_link: params[:shared_link].in?([true, 'true']),
                               folder: TemplateFolders.find_or_create_by_name(current_user, params[:folder_name]))

      authorize!(:create, @template)

      Templates.maybe_assign_access(@template)

      documents_params = params.permit(documents: [:name, :file, { fields: [field_params] }])[:documents]

      ApplicationRecord.transaction do
        @template.name = params[:name].presence || documents_params.first[:name].presence || 'New Template'
        @template.save!

        build_documents(@template, documents_params)

        @template.save!
      end

      WebhookUrls.enqueue_events(@template, 'template.created')

      SearchEntries.enqueue_reindex(@template)

      render json: Templates::SerializeForApi.call(@template)
    rescue Templates::CreateAttachments::PdfEncrypted
      render json: { error: 'PDF is password protected' }, status: :unprocessable_content
    end

    private

    def build_documents(template, documents_params)
      roles = documents_params.flat_map { |d| Array(d[:fields]).pluck(:role) }.compact_blank.uniq

      template.submitters = roles.map { |name| { 'name' => name, 'uuid' => SecureRandom.uuid } } if roles.present?

      template.schema = []
      template.fields = []

      documents_params.each_with_index do |document_params, index|
        fields_params = Array(document_params[:fields])

        attachment, = Templates::CreateAttachments.call(template, { files: [build_file(document_params, index)] },
                                                        extract_fields: fields_params.blank?).first

        template.schema << { 'attachment_uuid' => attachment.uuid,
                             'name' => document_params[:name].presence ||
                                       FilenameUtils.basename(attachment.blob.filename.to_s) }

        template.fields +=
          if fields_params.present?
            fields_params.map.with_index do |field, field_index|
              build_field(template, attachment, field, "documents[#{index}].fields[#{field_index}]")
            end
          else
            Templates::ProcessDocument.normalize_attachment_fields(template, [attachment])
          end
      end
    end

    def build_file(document_params, index)
      file = document_params[:file].to_s

      data =
        if file.match?(URL_REGEXP)
          DownloadUtils.call(file, validate: true).body
        else
          Base64.decode64(file.sub(BASE64_PREFIX_REGEXP, ''))
        end

      tempfile = Tempfile.new
      tempfile.binmode
      tempfile.write(data)
      tempfile.rewind

      unless Marcel::MimeType.for(tempfile) == PDF_CONTENT_TYPE
        raise Params::BaseValidator::InvalidParameterError, "documents[#{index}].file must be a PDF"
      end

      filename = document_params[:name].presence || 'document'
      filename = "#{filename}.pdf" unless filename.downcase.end_with?('.pdf')

      ActionDispatch::Http::UploadedFile.new(tempfile:, filename:, type: PDF_CONTENT_TYPE)
    end

    def build_field(template, attachment, field, path)
      submitter = template.submitters.find { |s| s['name'] == field[:role] } || template.submitters.first
      type = field[:type].presence || 'text'
      options = Array(field[:options]).map { |value| { 'value' => value.to_s, 'uuid' => SecureRandom.uuid } }
      areas = build_areas(attachment, field, options, path)

      {
        'uuid' => SecureRandom.uuid,
        'submitter_uuid' => submitter['uuid'],
        'name' => field[:name].to_s,
        'type' => type,
        'required' => field.key?(:required) ? field[:required].in?([true, 'true']) : type != 'checkbox',
        'title' => field[:title].presence,
        'description' => field[:description].presence,
        'preferences' => field[:preferences].to_h.presence,
        'validation' => field[:validation].to_h.compact_blank.presence,
        'options' => options.presence,
        'areas' => areas
      }.compact
    end

    def build_areas(attachment, field, options, path)
      number_of_pages = attachment.metadata.dig('pdf', 'number_of_pages').to_i

      Array(field[:areas]).map.with_index do |area, area_index|
        page = area[:page].to_i - 1

        if page >= number_of_pages
          raise Params::BaseValidator::InvalidParameterError,
                "#{path}.areas[#{area_index}].page must be at most #{number_of_pages}"
        end

        option_uuid = find_or_add_option(options, area[:option]) if area[:option].present?

        { 'uuid' => SecureRandom.uuid, 'x' => area[:x].to_f, 'y' => area[:y].to_f,
          'w' => area[:w].to_f, 'h' => area[:h].to_f, 'page' => page,
          'attachment_uuid' => attachment.uuid, 'option_uuid' => option_uuid }.compact
      end
    end

    def find_or_add_option(options, value)
      option = options.find { |o| o['value'] == value.to_s }

      unless option
        option = { 'value' => value.to_s, 'uuid' => SecureRandom.uuid }
        options << option
      end

      option['uuid']
    end

    def field_params
      [:name, :type, :role, :required, :title, :description,
       { areas: %i[x y w h page option], options: [], validation: %i[pattern message min max step],
         preferences: {} }]
    end
  end
end
