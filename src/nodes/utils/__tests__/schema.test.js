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
        type MagentoProductFragmentConfigurableProductConfigurableOptions {
            attribute_id: String
        }

        type MagentoProduct implements Node @dontInfer {
            configurable_options: [MagentoProductFragmentConfigurableProductConfigurableOptions]
            id: ID!
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
        type MagentoProductFragmentBundleProductItemsOptions {
            label: String
        }
        type MagentoProductFragmentBundleProductItems {
            options: [MagentoProductFragmentBundleProductItemsOptions]
        }

        type MagentoProduct implements Node @dontInfer {
            sku: String
            items: [MagentoProductFragmentBundleProductItems]
            id: ID!
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
                id: ID!
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
                id: ID!
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
