const allProductsQuery = `
query {
  products (
    filter:{
      sku: {
        like:"%"
      }
    }
    pageSize: 10000
  ) {
    items {
      id
      sku
      name
      type_id

      description {
        html
      }
      
      short_description {
        html
      }
      
      meta_title
      meta_keyword
      meta_description
      
      image {
        label
        url
      }

      url_key
      
      new_to_date
      new_from_date
      special_price
      
      updated_at

      ... on ConfigurableProduct {
        configurable_options {
          attribute_id          
          attribute_code          
          label
          values {
            label
            value_index
          }
        }
      }
      
      categories {
        id
        name
        url_path
      }

      price {
        regularPrice {
          amount {
            value
            currency
          }
        }
      }
    }
  }
}`;

export default allProductsQuery;
