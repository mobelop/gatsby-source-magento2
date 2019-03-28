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
      
      description
      short_description
      meta_title
      meta_keyword
      meta_description

      image      
      small_image
      
      url_key

      new      
      performance_fabric
      eco_collection
      
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
