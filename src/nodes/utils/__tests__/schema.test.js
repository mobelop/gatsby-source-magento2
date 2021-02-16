import { convertMagentoSchemaToGatsby } from '../schema';
import { print } from 'graphql/language/printer';
import gql from 'graphql-tag';
import fullSchema from './__fullSchema.json';
import allProductsQuery from '../../queries/products';

test('first level fields', () => {
    const query = `{
        products {
            items {
                sku
            }
        }
    }`;

    const result = convertMagentoSchemaToGatsby(
        query,
        fullSchema.data.__schema
    );

    expect(result).toEqual(
        print(gql`
            type MagentoProduct implements Node @dontInfer {
                sku: String
                id: ID!
                _xtypename: String
                parent: Node
                children: [Node!]!
                internal: Internal!
            }
        `)
    );
});

test('lists work', () => {
    const query = `{
        products {
            items {
                sku
                crosssell_products {
                    sku
                }
            }
        }
    }`;

    const result = convertMagentoSchemaToGatsby(
        query,
        fullSchema.data.__schema
    );

    const targetSchema = gql`
        type MagentoProductCrosssellProducts {
            sku: String
        }

        type MagentoProduct implements Node @dontInfer {
            sku: String
            crosssell_products: [MagentoProductCrosssellProducts]
            id: ID!
            _xtypename: String
            parent: Node
            children: [Node!]!
            internal: Internal!
        }
    `;

    expect(result).toEqual(print(targetSchema));
});

test('objects work', () => {
    const query = `{
        products {
            items {
                description {
                    html
                }
            }
        }
    }`;

    const result = convertMagentoSchemaToGatsby(
        query,
        fullSchema.data.__schema
    );

    const targetSchema = gql`
        type MagentoProductDescription {
            html: String
        }

        type MagentoProduct implements Node @dontInfer {
            description: MagentoProductDescription
            id: ID!
            _xtypename: String
            parent: Node
            children: [Node!]!
            internal: Internal!
        }
    `;

    expect(result).toEqual(print(targetSchema));
});

test('objects in objects', () => {
    const query = `{
        products {
            items {
                price_tiers {
                    discount {
                        amount_off
                    }
                }
            }
        }
    }`;

    const result = convertMagentoSchemaToGatsby(
        query,
        fullSchema.data.__schema
    );

    const targetSchema = gql`
        type MagentoProductPriceTiersDiscount {
            amount_off: Float
        }

        type MagentoProductPriceTiers {
            discount: MagentoProductPriceTiersDiscount
        }

        type MagentoProduct implements Node @dontInfer {
            price_tiers: [MagentoProductPriceTiers]
            id: ID!
            _xtypename: String
            parent: Node
            children: [Node!]!
            internal: Internal!
        }
    `;

    expect(result).toEqual(print(targetSchema));
});

test('fragments', () => {
    const query = `{
        products {
            items {
                ... on ConfigurableProduct {
                    configurable_options {
                        attribute_id
                    }
                }
            }
        }
    }`;

    const result = convertMagentoSchemaToGatsby(
        query,
        fullSchema.data.__schema
    );

    const targetSchema = gql`
        type MagentoProductConfigurableOptions {
            attribute_id: String
        }

        type MagentoProduct implements Node @dontInfer {
            configurable_options: [MagentoProductConfigurableOptions]
            id: ID!
            _xtypename: String
            parent: Node
            children: [Node!]!
            internal: Internal!
        }
    `;

    expect(result).toEqual(print(targetSchema));
});

test('fragments on BundleProduct', () => {
    const query = `{
        products {
            items {
                sku
      
              ... on BundleProduct {
                items {
                  options {
                    label
                  }
                }
              }
            }
        }
    }`;

    const result = convertMagentoSchemaToGatsby(
        query,
        fullSchema.data.__schema
    );

    const targetSchema = gql`
        type MagentoProductItemsOptions {
            label: String
        }
        type MagentoProductItems {
            options: [MagentoProductItemsOptions]
        }

        type MagentoProduct implements Node @dontInfer {
            sku: String
            items: [MagentoProductItems]
            id: ID!
            _xtypename: String
            parent: Node
            children: [Node!]!
            internal: Internal!
        }
    `;

    expect(result).toEqual(print(targetSchema));
});

test('overlapping fragments are merged into one type', () => {
    const query = `{
        products {
            items {
              sku
              ... on BundleProduct {
                dynamic_sku
                items {
                  options {
                    label
                    can_change_quantity
                  }
                }
              }
              ... on GroupedProduct {
                items {
                  position
                  qty
                  product {
                    name
                    sku
                  }
                }
              }
            }
        }
    }`;

    const result = convertMagentoSchemaToGatsby(
        query,
        fullSchema.data.__schema
    );

    const targetSchema = gql`
        type MagentoProductItemsOptions {
            label: String
            can_change_quantity: Boolean
        }

        type MagentoProductItems {
            options: [MagentoProductItemsOptions]
            position: Int
            qty: Float
            product: MagentoProductItemsProduct
        }
        
        type MagentoProductItemsProduct {
          name: String
          sku: String
        }

        type MagentoProduct implements Node @dontInfer {
            sku: String
            dynamic_sku: Boolean
            items: [MagentoProductItems]
            id: ID!
            _xtypename: String
            parent: Node
            children: [Node!]!
            internal: Internal!
        }
    `;

    expect(result).toEqual(print(targetSchema));
});

test('fragments: ProductPrices', () => {
    const query = `
    fragment ProductPrices on ProductInterface  {
        special_price
        price_tiers {
            discount {
              amount_off
            }
        }
    }

    query {
        products {
            items {
                sku
                ...ProductPrices
            }
        }
    }`;

    const result = convertMagentoSchemaToGatsby(
        query,
        fullSchema.data.__schema
    );

    const targetSchema = gql`
        type MagentoProductPriceTiersDiscount {
            amount_off: Float
        }

        type MagentoProductPriceTiers {
            discount: MagentoProductPriceTiersDiscount
        }

        type MagentoProduct implements Node @dontInfer {
            sku: String
            special_price: Float
            price_tiers: [MagentoProductPriceTiers]
            id: ID!
            _xtypename: String
            parent: Node
            children: [Node!]!
            internal: Internal!
        }
    `;

    expect(result).toEqual(print(targetSchema));
});

test('category query works', () => {
    const query = `
    query fetchCategory($id: Int!){
        category(id: $id) {
            children {
                name
            }
        }
    }`;

    const result = convertMagentoSchemaToGatsby(
        query,
        fullSchema.data.__schema
    );

    expect(result).toEqual(
        print(gql`
            type MagentoCategory implements Node @dontInfer {
                name: String
                magento_id: Int
                parent_category_id: Int
                id: ID!
                _xtypename: String
                parent: Node
                children: [Node!]!
                internal: Internal!
            }
        `)
    );
});

test('category selections work', () => {
    const query = `
    query fetchCategory($id: Int!){
        category(id: $id) {
            children {
                products(pageSize: 10000) {
                    items {
                        id
                    }
                }
            }
        }
    }`;

    const result = convertMagentoSchemaToGatsby(
        query,
        fullSchema.data.__schema
    );

    expect(result).toEqual(
        print(gql`
            type MagentoCategoryProductsItems {
                id: Int
            }

            type MagentoCategoryProducts {
                items: [MagentoCategoryProductsItems]
            }

            type MagentoCategory implements Node @dontInfer {
                products: MagentoCategoryProducts
                magento_id: Int
                parent_category_id: Int
                id: ID!
                _xtypename: String
                parent: Node
                children: [Node!]!
                internal: Internal!
            }
        `)
    );
});

test('images are linked to File nodes for categories', () => {
    const query = `
    {
        category(id: $id) {
            children {
                image
            }
        }
    }
    `;

    const result = convertMagentoSchemaToGatsby(
        query,
        fullSchema.data.__schema
    );

    expect(result).toEqual(
        print(gql`
            type MagentoCategory implements Node @dontInfer {
                image: File @link(from: "image___NODE")
                magento_id: Int
                parent_category_id: Int
                id: ID!
                _xtypename: String
                parent: Node
                children: [Node!]!
                internal: Internal!
            }
        `)
    );
});

test('images are linked to File nodes for products', () => {
    const query = `
    {
        products {
            items {
                image
            }
        }
    }
    `;

    const result = convertMagentoSchemaToGatsby(
        query,
        fullSchema.data.__schema
    );

    expect(result).toEqual(
        print(gql`
            type MagentoProduct implements Node @dontInfer {
                image: File @link(from: "image___NODE")
                id: ID!
                _xtypename: String
                parent: Node
                children: [Node!]!
                internal: Internal!
            }
        `)
    );
});

test('images are linked to File nodes for categories', () => {
    const query = `
    {
        category(id: {eq: 1}) {
            children {
                products {
                    items {
                        image
                    }
                }
            }
        }
    }
    `;

    const result = convertMagentoSchemaToGatsby(
        query,
        fullSchema.data.__schema
    );

    expect(result).toEqual(
        print(gql`
            type MagentoCategoryProductsItems {
                image: File @link(from: "image___NODE")
            }

            type MagentoCategoryProducts {
                items: [MagentoCategoryProductsItems]
            }
            
            type MagentoCategory implements Node @dontInfer {
                products: MagentoCategoryProducts
                magento_id: Int
                parent_category_id: Int
                id: ID!
                _xtypename: String
                parent: Node
                children: [Node!]!
                internal: Internal!
            }
        `)
    );
});

test('File nodes are created for media_gallery entries', () => {
    const query = `
    {
        products {
            items {
                media_gallery {
                    url
                    label
                    position
                }
            }
        }
    }
    `;

    const result = convertMagentoSchemaToGatsby(
        query,
        fullSchema.data.__schema
    );

    expect(result).toEqual(
        print(gql`
            type MagentoProductMediaGallery {
               url: String
               label: String
               position: Int
               image: File @link(from: "image___NODE")
            }

            type MagentoProduct implements Node @dontInfer {
                media_gallery: [MagentoProductMediaGallery]
                id: ID!
                _xtypename: String
                parent: Node
                children: [Node!]!
                internal: Internal!
            }
        `)
    );
});

test('generates schema for the full query', () => {
    const result = convertMagentoSchemaToGatsby(
        allProductsQuery,
        fullSchema.data.__schema
    );
});

test('generates schema for the full query 2', () => {
    const result = convertMagentoSchemaToGatsby(
        allProductsQuery2,
        fullSchema.data.__schema
    );
});

test('generates schema for the full category query', () => {
    const result = convertMagentoSchemaToGatsby(
        allCategoryQuery,
        fullSchema.data.__schema
    );
});

const allProductsQuery2 = `fragment ProductPrices on ProductInterface  {
    price_range {
        maximum_price {
          discount { amount_off percent_off}
          final_price { currency value }
          fixed_product_taxes { amount {currency value} label}
          regular_price { currency value }
        }
        minimum_price {
          discount { percent_off amount_off}
          final_price { currency value }
          fixed_product_taxes { amount {currency value} label}
          regular_price { currency value }
        }
      }  
    special_price
    price_tiers {
        discount {
          amount_off
          percent_off
        }
    
        final_price {
          currency
          value
        }
    
        quantity
      }
}

query {
  products (
    search:""
    pageSize: 500
  ) {
    items {
      id
      sku
      name
      manufacturer
      created_at
      updated_at
      type_id
      __typename
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
      manufacturer
      small_image {label url}
      thumbnail {label url}
      price {
        regularPrice {
          adjustments {
            amount {
              currency
              value
            }
          }
          amount {
            currency
            value
          }
        }
        maximalPrice {
          adjustments {
            amount {
              currency
              value
            }
          }
          amount {
            currency
            value
          }
        }
    
        minimalPrice {
          adjustments {
            amount {
              currency
              value
            }
          }
          amount {
            currency
            value
          }
        }
      }
      ...ProductPrices
            
      categories {
        id
        name
        url_path
        image
      }

      ... on CustomizableProductInterface {
        options {
          title
          required
          sort_order
          option_id
          
          ... on CustomizableDropDownOption {
            value {
              sku
              price
              price_type
              sort_order
              title
              option_type_id
            }
          }

        }
      }
      
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
      
      ... on GroupedProduct {
        items {
          position
          qty
          product {
            name
            sku
            manufacturer
            __typename
            price {
                regularPrice {
                  adjustments {
                    amount {
                      currency
                      value
                    }
                  }
                  amount {
                    currency
                    value
                  }
                }
                maximalPrice {
                  adjustments {
                    amount {
                      currency
                      value
                    }
                  }
                  amount {
                    currency
                    value
                  }
                }
            
                minimalPrice {
                  adjustments {
                    amount {
                      currency
                      value
                    }
                  }
                  amount {
                    currency
                    value
                  }
                }
              }
            ...ProductPrices
          }
        }
      }
      
      ... on BundleProduct {
        items {
          option_id
          options {
            id
            label
            position
            price
            price_type
            product {
              sku
              __typename
            }
            
            can_change_quantity
            is_default          
          }
        }
      }
      
    }
  } 
}`;

const allCategoryQuery = `
  query fetchCategory($id: Int!) {
    category(id: $id) {
      children {
        id
        name
        description

        url_key
        url_path

        image

        children_count
        position

        level
        product_count
        default_sort_by
        meta_title
        meta_keywords
        meta_description
        landing_page
        is_anchor
        include_in_menu
        filter_price_range
        display_mode
        available_sort_by

        breadcrumbs {
          category_id
          category_name
          category_level
          category_url_key
        }

        products(pageSize: 10000) {
          items {
            id
            url_key
            name

            image {
              label
              url
            }

            price {
              regularPrice {
                adjustments {
                  amount {
                    currency
                    value
                  }
                }
                amount {
                  currency
                  value
                }
              }
              maximalPrice {
                adjustments {
                  amount {
                    currency
                    value
                  }
                }
                amount {
                  currency
                  value
                }
              }

              minimalPrice {
                adjustments {
                  amount {
                    currency
                    value
                  }
                }
                amount {
                  currency
                  value
                }
              }
            }
          }
        }

        path
        path_in_store
      }
    }
  }

`
