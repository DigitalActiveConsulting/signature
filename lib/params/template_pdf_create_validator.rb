# frozen_string_literal: true

module Params
  class TemplatePdfCreateValidator < BaseValidator
    FIELD_TYPES = %w[heading text signature initials date datenow number image file select checkbox multiple
                     radio cells stamp payment phone verification kba strikethrough].freeze

    def call
      required(params, :documents)
      type(params, :documents, Array)
      type(params, :name, String)
      type(params, :folder_name, String)
      boolean(params, :shared_link)

      in_path_each(params, :documents) do |document|
        required(document, :file)
        type(document, :file, String)
        type(document, :name, String)
        type(document, :fields, Array)

        in_path_each(document, :fields) do |field|
          validate_field(field)
        end
      end

      true
    end

    def validate_field(field)
      type(field, :name, String)
      type(field, :role, String)
      value_in(field, :type, FIELD_TYPES, allow_nil: true)
      boolean(field, :required)
      type(field, :areas, Array)
      type(field, :options, Array)

      in_path_each(field, :areas) do |area|
        required(area, :page)
        more_than(area, :page, 0)

        %i[x y w h].each do |key|
          required(area, key)
          type(area, key, Numeric)
        end
      end
    end
  end
end
