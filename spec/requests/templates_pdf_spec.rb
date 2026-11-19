# frozen_string_literal: true

describe 'Templates PDF API' do
  let(:account) { create(:account) }
  let(:author) { create(:user, account:) }

  let(:pdf_base64) do
    doc = HexaPDF::Document.new
    2.times { doc.pages.add }
    io = StringIO.new
    doc.write(io)

    Base64.strict_encode64(io.string)
  end

  let(:fields) do
    [
      { name: 'Provider signature', type: 'signature', role: 'Provider', required: true,
        areas: [{ x: 0.1, y: 0.8, w: 0.3, h: 0.05, page: 2 }] },
      { name: 'Provider date', type: 'date', role: 'Provider',
        areas: [{ x: 0.1, y: 0.86, w: 0.2, h: 0.03, page: 2 }] },
      { name: 'Client signature', type: 'signature', role: 'Client',
        areas: [{ x: 0.55, y: 0.8, w: 0.3, h: 0.05, page: 2 }] },
      { name: 'Client date', type: 'date', role: 'Client', required: false,
        areas: [{ x: 0.55, y: 0.1, w: 0.2, h: 0.03, page: 1 }] }
    ]
  end

  let(:body) do
    { name: 'MSA', folder_name: 'Contracts', documents: [{ name: 'MSA v1', file: pdf_base64, fields: }] }
  end

  describe 'POST /api/templates/pdf' do
    it 'creates a template with roles as signers and fields placed on the given pages' do
      post '/api/templates/pdf', headers: { 'x-auth-token': author.access_token.token }, params: body, as: :json

      expect(response).to have_http_status(:ok)

      template = Template.find(response.parsed_body['id'])
      document = template.documents.first

      expect(response.parsed_body).to eq(JSON.parse(Templates::SerializeForApi.call(template).to_json))
      expect(template.name).to eq('MSA')
      expect(template.folder.name).to eq('Contracts')
      expect(template.source).to eq('api')
      expect(template.schema).to eq([{ 'attachment_uuid' => document.uuid, 'name' => 'MSA v1' }])
      expect(document.metadata.dig('pdf', 'number_of_pages')).to eq(2)
      expect(document.preview_images.count).to eq(2)

      provider, client = template.submitters

      expect(template.submitters.pluck('name')).to eq(%w[Provider Client])
      expect(template.fields.map { |f| f.slice('name', 'type', 'required', 'submitter_uuid') }).to eq(
        [
          { 'name' => 'Provider signature', 'type' => 'signature', 'required' => true,
            'submitter_uuid' => provider['uuid'] },
          { 'name' => 'Provider date', 'type' => 'date', 'required' => true, 'submitter_uuid' => provider['uuid'] },
          { 'name' => 'Client signature', 'type' => 'signature', 'required' => true,
            'submitter_uuid' => client['uuid'] },
          { 'name' => 'Client date', 'type' => 'date', 'required' => false, 'submitter_uuid' => client['uuid'] }
        ]
      )
      expect(template.fields.map { |f| f['areas'].first.except('uuid') }).to eq(
        [
          { 'x' => 0.1, 'y' => 0.8, 'w' => 0.3, 'h' => 0.05, 'page' => 1, 'attachment_uuid' => document.uuid },
          { 'x' => 0.1, 'y' => 0.86, 'w' => 0.2, 'h' => 0.03, 'page' => 1, 'attachment_uuid' => document.uuid },
          { 'x' => 0.55, 'y' => 0.8, 'w' => 0.3, 'h' => 0.05, 'page' => 1, 'attachment_uuid' => document.uuid },
          { 'x' => 0.55, 'y' => 0.1, 'w' => 0.2, 'h' => 0.03, 'page' => 0, 'attachment_uuid' => document.uuid }
        ]
      )
    end

    it 'returns the created template from GET /api/templates/:id' do
      post '/api/templates/pdf', headers: { 'x-auth-token': author.access_token.token }, params: body, as: :json

      get "/api/templates/#{response.parsed_body['id']}", headers: { 'x-auth-token': author.access_token.token }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['fields'].size).to eq(4)
      expect(response.parsed_body['submitters'].pluck('name')).to eq(%w[Provider Client])
    end

    it 'rejects an invalid API token' do
      expect do
        post '/api/templates/pdf', headers: { 'x-auth-token': 'invalid' }, params: body, as: :json
      end.not_to change(Template, :count)

      expect(response).to have_http_status(:unauthorized)
      expect(response.parsed_body).to eq({ 'error' => 'Not authenticated' })
    end

    it 'rejects a document without a file' do
      body[:documents].first.delete(:file)

      expect do
        post '/api/templates/pdf', headers: { 'x-auth-token': author.access_token.token }, params: body, as: :json
      end.not_to change(Template, :count)

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body).to eq({ 'error' => 'file is required in `documents[0]`.' })
    end

    it 'rejects a file that is not a PDF' do
      body[:documents].first[:file] = Base64.strict_encode64('not a pdf')

      expect do
        post '/api/templates/pdf', headers: { 'x-auth-token': author.access_token.token }, params: body, as: :json
      end.not_to change(Template, :count)

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body).to eq({ 'error' => 'documents[0].file must be a PDF' })
    end

    it 'rejects an area on a page the document does not have' do
      fields.first[:areas].first[:page] = 3

      expect do
        post '/api/templates/pdf', headers: { 'x-auth-token': author.access_token.token }, params: body, as: :json
      end.not_to change(Template, :count)

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body).to eq({ 'error' => 'documents[0].fields[0].areas[0].page must be at most 2' })
    end
  end
end
