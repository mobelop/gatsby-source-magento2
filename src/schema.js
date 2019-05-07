//
// partial schema (needed to ensure optional fields are present in the schema)
const schema = `
type MagentoProduct implements Node {
    configurable_options: [ConfigurableOptions]
}

type ConfigurableOptions {
    attribute_id: String          
    attribute_code: String          
    label: String
    values: [OptionValue]
}
      
type OptionValue {
    label: String
    value_index: String
}

type MagentoCmsBlock implements Node {
    title: String
    content: String
}

type CmsTextBlockNode implements Node {
    type: String
    value: String
}      

type CmsProductListNode implements Node {
    type: String
    value: String
    count: Int
    products: [Node!]
}      
      
`;

export default schema;
