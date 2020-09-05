import { print } from 'graphql/language/printer';
import { Kind } from 'graphql';
import gql from 'graphql-tag';

export function convertMagentoSchemaToGatsby(query, schema) {
    const typeMap = buildTypeMap(schema);

    const result = {
        kind: Kind.DOCUMENT,
        definitions: [],
    };

    const context = {
        typeStack: [],
        typeMap,
        result,
        selectionStack: [],
    };

    context.typeStack.push(typeMap.ProductInterface);

    const parsedQuery = gql(query);

    for (const definition of parsedQuery.definitions) {
        if (definition.kind === Kind.OPERATION_DEFINITION) {
            scanSelections(
                context,
                definition.selectionSet.selections[0].selectionSet.selections[0]
            );
        }
    }

    // query.definitions
    console.log('GENeRATED SHEMA:', JSON.stringify(result, 0, 4));

    return print(result);
}

function scanSelections(context, definition) {
    const {
        selectionSet: { selections },
    } = definition;

    const fields = [];

    // console.log('def:', definition);
    for (const selection of selections) {
        if (selection.selectionSet) {
            const field = findField(context, selection);
            console.log('dig into:', field);

            let needToPopType = false;
            if (field.type.kind === 'OBJECT') {
                context.selectionStack.push(field.type.name);
                context.typeStack.push(context.typeMap[field.type.name]);
                needToPopType = true;
            } else if (field.type.kind === 'LIST') {
                context.selectionStack.push(selection.name.value);
                if (field.type.ofType) {
                    context.typeStack.push(context.typeMap[field.type.ofType.name]);
                    needToPopType = true;
                }
            } else {
                context.selectionStack.push(selection.name.value);
            }

            // context.selectionStack.push(selection.name.value);
            const def = scanSelections(context, selection);
            context.selectionStack.pop();

            if (needToPopType) {
                context.typeStack.pop();
            }

            fields.push(genNamedFieldDef(def, selection));
        } else {
            const field = genField(context, selection);
            fields.push(field);
        }
    }

    if (fields.length) {
        let typeName = 'MagentoProduct';

        if (context.selectionStack.length) {
            typeName =
                'Magento' +
                context.selectionStack.map(item =>
                    capitalizeFirstLetter(snakeToCamel(item))
                );
        }

        const definition = {
            kind: 'ObjectTypeDefinition',
            name: {
                kind: 'Name',
                value: typeName,
            },
            fields,
        };
        context.result.definitions.push(definition);

        return definition;
    }
}

function snakeToCamel(s) {
    return s.replace(/(\_\w)/g, function(m) {
        return m[1].toUpperCase();
    });
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function genField(context, selection) {
    return {
        kind: Kind.FIELD_DEFINITION,
        name: {
            kind: 'Name',
            value: selection.name.value,
        },
        type: fieldType(context, selection),
    };
}

function genNamedFieldDef(def, selection) {
    return {
        kind: 'FieldDefinition',
        name: {
            kind: 'Name',
            value: selection.name.value,
        },
        type: {
            kind: 'NamedType',
            name: {
                kind: 'Name',
                value: def.name.value,
            },
        },
    };
}

function findField(context, selection) {
    const { typeStack } = context;
    const { fields } = typeStack[typeStack.length - 1];
    const fieldName = selection.name.value;
    for (const field of fields) {
        if (field.name === fieldName) {
            return field;
        }
    }

    throw Error(
        `couldn't find field ${fieldName} on type ${typeStack[typeStack.length - 1].name}`
    );
    return null;
}

function fieldType(context, selection) {
    const field = findField(context, selection);

    if (field) {
        if (field.type.kind === 'SCALAR') {
            return {
                kind: 'NamedType',
                name: {
                    kind: 'Name',
                    value: field.type.name,
                },
            };
        }
    }

    return {
        kind: 'NamedType',
        name: {
            kind: 'Name',
            value: 'String',
        },
    };
}

function buildTypeMap(schema) {
    const { types } = schema;
    const typeMap = {};
    for (const type of types) {
        typeMap[type.name] = type;
    }
    return typeMap;
}

// export function convertMagentoSchemaToGatsby(types) {
//     const typeMap = {};
//
//     for (const type of types) {
//         mapTypes(type, typeMap);
//     }
//
//     console.log(JSON.stringify(typeMap));
//
//     const result = {
//         kind: Kind.DOCUMENT,
//         definitions: Object.values(typeMap),
//     };
//
//     console.log('result:', JSON.stringify(result, 0, 4));
//
//     return print(result);
// }
//
// function mapTypes(type, typeMap) {
//     const fields = [];
//     if (Array.isArray(type.fields)) {
//         for (const field of type.fields) {
//             switch (field.type.kind) {
//                 case 'OBJECT':
//                     mapTypes(field.type, typeMap);
//
//                     fields.push({
//                         kind: 'FieldDefinition',
//                         name: {
//                             kind: 'Name',
//                             value: field.name,
//                         },
//                         type: {
//                             kind: 'NamedType',
//                             name: {
//                                 kind: 'Name',
//                                 value: magentoTypeName(field.type.name),
//                             },
//                         },
//                     });
//
//                     break;
//
//                 case 'SCALAR':
//                     fields.push({
//                         kind: 'FieldDefinition',
//                         name: {
//                             kind: 'Name',
//                             value: field.name,
//                         },
//                         type: {
//                             kind: 'NamedType',
//                             name: {
//                                 kind: 'Name',
//                                 value: magentoTypeName(field.type.name),
//                             },
//                         },
//                     });
//                     break;
//
//                 case 'NON_NULL':
//                     try {
//                         fields.push({
//                             kind: 'FieldDefinition',
//                             name: {
//                                 kind: 'Name',
//                                 value: field.name,
//                             },
//                             type: {
//                                 kind: 'NamedType',
//                                 name: {
//                                     kind: 'Name',
//                                     value: magentoTypeName(
//                                         field.type.ofType.name
//                                     ),
//                                 },
//                             },
//                         });
//                     } catch (e) {
//                         console.error(e);
//                         console.log('while processing:', JSON.stringify(field));
//                     }
//                     break;
//
//                 case 'LIST':
//                     try {
//                         if (field.type.ofType.name) {
//                             fields.push({
//                                 kind: 'FieldDefinition',
//                                 name: {
//                                     kind: 'Name',
//                                     value: field.name,
//                                 },
//                                 type: {
//                                     kind: 'ListType',
//                                     type: {
//                                         kind: 'NamedType',
//                                         name: {
//                                             kind: 'Name',
//                                             value: magentoTypeName(
//                                                 field.type.ofType.name
//                                             ),
//                                         },
//                                     },
//                                 },
//                             });
//                         }
//                     } catch (e) {
//                         console.error(e);
//                         console.log('while processing:', JSON.stringify(field));
//                     }
//                     break;
//             }
//         }
//     }
//
//     const typeName = magentoTypeName(type.name);
//
//     typeMap[type.name] = {
//         kind: 'ObjectTypeDefinition',
//         name: {
//             kind: 'Name',
//             value: typeName,
//         },
//         fields,
//     };
// }

function magentoTypeName(name) {
    switch (name) {
        case 'String':
            return name;
        case 'Int':
            return name;
        case 'Boolean':
            return name;
    }
    return 'Magento' + name.replace('Interface', '');
}

export async function getRemoteGraphQLSchema(config) {
    return JSON.parse(`{
  "data": {
    "productType": {
      "name": "ProductInterface",
      "fields": [
        {
          "name": "activity",
          "description": null,
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "attribute_set_id",
          "description": "The attribute set assigned to the product.",
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "canonical_url",
          "description": "Relative canonical URL. This value is returned only if the system setting 'Use Canonical Link Meta Tag For Products' is enabled",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "categories",
          "description": "The categories assigned to a product.",
          "type": {
            "name": null,
            "kind": "LIST",
            "ofType": {
              "name": "CategoryInterface",
              "kind": "INTERFACE"
            },
            "fields": null
          }
        },
        {
          "name": "category_gear",
          "description": null,
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "climate",
          "description": null,
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "collar",
          "description": null,
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "color",
          "description": null,
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "country_of_manufacture",
          "description": "The product's country of origin.",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "created_at",
          "description": "Timestamp indicating when the product was created.",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "crosssell_products",
          "description": "Crosssell Products",
          "type": {
            "name": null,
            "kind": "LIST",
            "ofType": {
              "name": "ProductInterface",
              "kind": "INTERFACE"
            },
            "fields": null
          }
        },
        {
          "name": "description",
          "description": "Detailed information about the product. The value can include simple HTML tags.",
          "type": {
            "name": "ComplexTextValue",
            "kind": "OBJECT",
            "ofType": null,
            "fields": [
              {
                "name": "html",
                "description": "HTML format",
                "type": {
                  "name": null,
                  "kind": "NON_NULL",
                  "ofType": {
                    "name": "String",
                    "kind": "SCALAR"
                  },
                  "fields": null
                }
              }
            ]
          }
        },
        {
          "name": "eco_collection",
          "description": null,
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "erin_recommends",
          "description": null,
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "features_bags",
          "description": null,
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "format",
          "description": null,
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "gender",
          "description": null,
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "gift_message_available",
          "description": "Indicates whether a gift message is available.",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "id",
          "description": "The ID number assigned to the product.",
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "image",
          "description": "The relative path to the main image on the product page.",
          "type": {
            "name": "ProductImage",
            "kind": "OBJECT",
            "ofType": null,
            "fields": [
              {
                "name": "disabled",
                "description": "Whether the image is hidden from view.",
                "type": {
                  "name": "Boolean",
                  "kind": "SCALAR",
                  "ofType": null,
                  "fields": null
                }
              },
              {
                "name": "label",
                "description": "The label of the product image or video.",
                "type": {
                  "name": "String",
                  "kind": "SCALAR",
                  "ofType": null,
                  "fields": null
                }
              },
              {
                "name": "position",
                "description": "The media item's position after it has been sorted.",
                "type": {
                  "name": "Int",
                  "kind": "SCALAR",
                  "ofType": null,
                  "fields": null
                }
              },
              {
                "name": "url",
                "description": "The URL of the product image or video.",
                "type": {
                  "name": "String",
                  "kind": "SCALAR",
                  "ofType": null,
                  "fields": null
                }
              }
            ]
          }
        },
        {
          "name": "manufacturer",
          "description": "A number representing the product's manufacturer.",
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "material",
          "description": null,
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "media_gallery",
          "description": "An array of Media Gallery objects.",
          "type": {
            "name": null,
            "kind": "LIST",
            "ofType": {
              "name": "MediaGalleryInterface",
              "kind": "INTERFACE"
            },
            "fields": null
          }
        },
        {
          "name": "meta_description",
          "description": "A brief overview of the product for search results listings, maximum 255 characters.",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "meta_keyword",
          "description": "A comma-separated list of keywords that are visible only to search engines.",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "meta_title",
          "description": "A string that is displayed in the title bar and tab of the browser and in search results lists.",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "name",
          "description": "The product name. Customers use this name to identify the product.",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "new",
          "description": null,
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "new_from_date",
          "description": "The beginning date for new product listings, and determines if the product is featured as a new product.",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "new_to_date",
          "description": "The end date for new product listings.",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "only_x_left_in_stock",
          "description": "Product stock only x left count",
          "type": {
            "name": "Float",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "options_container",
          "description": "If the product has multiple options, determines where they appear on the product page.",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "pattern",
          "description": null,
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "performance_fabric",
          "description": null,
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "price_range",
          "description": "A PriceRange object, indicating the range of prices for the product",
          "type": {
            "name": null,
            "kind": "NON_NULL",
            "ofType": {
              "name": "PriceRange",
              "kind": "OBJECT"
            },
            "fields": null
          }
        },
        {
          "name": "price_tiers",
          "description": "An array of TierPrice objects.",
          "type": {
            "name": null,
            "kind": "LIST",
            "ofType": {
              "name": "TierPrice",
              "kind": "OBJECT"
            },
            "fields": null
          }
        },
        {
          "name": "product_links",
          "description": "An array of ProductLinks objects.",
          "type": {
            "name": null,
            "kind": "LIST",
            "ofType": {
              "name": "ProductLinksInterface",
              "kind": "INTERFACE"
            },
            "fields": null
          }
        },
        {
          "name": "related_products",
          "description": "Related Products",
          "type": {
            "name": null,
            "kind": "LIST",
            "ofType": {
              "name": "ProductInterface",
              "kind": "INTERFACE"
            },
            "fields": null
          }
        },
        {
          "name": "sale",
          "description": null,
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "short_description",
          "description": "A short description of the product. Its use depends on the theme.",
          "type": {
            "name": "ComplexTextValue",
            "kind": "OBJECT",
            "ofType": null,
            "fields": [
              {
                "name": "html",
                "description": "HTML format",
                "type": {
                  "name": null,
                  "kind": "NON_NULL",
                  "ofType": {
                    "name": "String",
                    "kind": "SCALAR"
                  },
                  "fields": null
                }
              }
            ]
          }
        },
        {
          "name": "size",
          "description": null,
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "sku",
          "description": "A number or code assigned to a product to identify the product, options, price, and manufacturer.",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "sleeve",
          "description": null,
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "small_image",
          "description": "The relative path to the small image, which is used on catalog pages.",
          "type": {
            "name": "ProductImage",
            "kind": "OBJECT",
            "ofType": null,
            "fields": [
              {
                "name": "disabled",
                "description": "Whether the image is hidden from view.",
                "type": {
                  "name": "Boolean",
                  "kind": "SCALAR",
                  "ofType": null,
                  "fields": null
                }
              },
              {
                "name": "label",
                "description": "The label of the product image or video.",
                "type": {
                  "name": "String",
                  "kind": "SCALAR",
                  "ofType": null,
                  "fields": null
                }
              },
              {
                "name": "position",
                "description": "The media item's position after it has been sorted.",
                "type": {
                  "name": "Int",
                  "kind": "SCALAR",
                  "ofType": null,
                  "fields": null
                }
              },
              {
                "name": "url",
                "description": "The URL of the product image or video.",
                "type": {
                  "name": "String",
                  "kind": "SCALAR",
                  "ofType": null,
                  "fields": null
                }
              }
            ]
          }
        },
        {
          "name": "special_from_date",
          "description": "The beginning date that a product has a special price.",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "special_price",
          "description": "The discounted price of the product.",
          "type": {
            "name": "Float",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "special_to_date",
          "description": "The end date that a product has a special price.",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "stock_status",
          "description": "Stock status of the product",
          "type": {
            "name": "ProductStockStatus",
            "kind": "ENUM",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "strap_bags",
          "description": null,
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "style_bags",
          "description": null,
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "style_bottom",
          "description": null,
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "style_general",
          "description": null,
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "swatch_image",
          "description": "The file name of a swatch image",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "thumbnail",
          "description": "The relative path to the product's thumbnail image.",
          "type": {
            "name": "ProductImage",
            "kind": "OBJECT",
            "ofType": null,
            "fields": [
              {
                "name": "disabled",
                "description": "Whether the image is hidden from view.",
                "type": {
                  "name": "Boolean",
                  "kind": "SCALAR",
                  "ofType": null,
                  "fields": null
                }
              },
              {
                "name": "label",
                "description": "The label of the product image or video.",
                "type": {
                  "name": "String",
                  "kind": "SCALAR",
                  "ofType": null,
                  "fields": null
                }
              },
              {
                "name": "position",
                "description": "The media item's position after it has been sorted.",
                "type": {
                  "name": "Int",
                  "kind": "SCALAR",
                  "ofType": null,
                  "fields": null
                }
              },
              {
                "name": "url",
                "description": "The URL of the product image or video.",
                "type": {
                  "name": "String",
                  "kind": "SCALAR",
                  "ofType": null,
                  "fields": null
                }
              }
            ]
          }
        },
        {
          "name": "updated_at",
          "description": "Timestamp indicating when the product was updated.",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "upsell_products",
          "description": "Upsell Products",
          "type": {
            "name": null,
            "kind": "LIST",
            "ofType": {
              "name": "ProductInterface",
              "kind": "INTERFACE"
            },
            "fields": null
          }
        },
        {
          "name": "url_key",
          "description": "The part of the URL that identifies the product",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "url_rewrites",
          "description": "URL rewrites list",
          "type": {
            "name": null,
            "kind": "LIST",
            "ofType": {
              "name": "UrlRewrite",
              "kind": "OBJECT"
            },
            "fields": null
          }
        },
        {
          "name": "url_suffix",
          "description": "The part of the product URL that is appended after the url key",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        }
      ]
    },
    "categoryType": {
      "name": "CategoryInterface",
      "fields": [
        {
          "name": "available_sort_by",
          "description": null,
          "type": {
            "name": null,
            "kind": "LIST",
            "ofType": {
              "name": "String",
              "kind": "SCALAR"
            },
            "fields": null
          }
        },
        {
          "name": "breadcrumbs",
          "description": "Breadcrumbs, parent categories info.",
          "type": {
            "name": null,
            "kind": "LIST",
            "ofType": {
              "name": "Breadcrumb",
              "kind": "OBJECT"
            },
            "fields": null
          }
        },
        {
          "name": "canonical_url",
          "description": "Relative canonical URL. This value is returned only if the system setting 'Use Canonical Link Meta Tag For Categories' is enabled",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "children_count",
          "description": null,
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "cms_block",
          "description": "Category CMS Block.",
          "type": {
            "name": "CmsBlock",
            "kind": "OBJECT",
            "ofType": null,
            "fields": [
              {
                "name": "content",
                "description": "CMS block content",
                "type": {
                  "name": "String",
                  "kind": "SCALAR",
                  "ofType": null,
                  "fields": null
                }
              },
              {
                "name": "identifier",
                "description": "CMS block identifier",
                "type": {
                  "name": "String",
                  "kind": "SCALAR",
                  "ofType": null,
                  "fields": null
                }
              },
              {
                "name": "title",
                "description": "CMS block title",
                "type": {
                  "name": "String",
                  "kind": "SCALAR",
                  "ofType": null,
                  "fields": null
                }
              }
            ]
          }
        },
        {
          "name": "created_at",
          "description": "Timestamp indicating when the category was created.",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "custom_layout_update_file",
          "description": null,
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "default_sort_by",
          "description": "The attribute to use for sorting.",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "description",
          "description": "An optional description of the category.",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "display_mode",
          "description": null,
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "filter_price_range",
          "description": null,
          "type": {
            "name": "Float",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "id",
          "description": "An ID that uniquely identifies the category.",
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "image",
          "description": null,
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "include_in_menu",
          "description": null,
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "is_anchor",
          "description": null,
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "landing_page",
          "description": null,
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "level",
          "description": "Indicates the depth of the category within the tree.",
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "meta_description",
          "description": null,
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "meta_keywords",
          "description": null,
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "meta_title",
          "description": null,
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "name",
          "description": "The display name of the category.",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "path",
          "description": "Category Path.",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "path_in_store",
          "description": "Category path in store.",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "position",
          "description": "The position of the category relative to other categories at the same level in tree.",
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "product_count",
          "description": "The number of products in the category.",
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "products",
          "description": "The list of products assigned to the category.",
          "type": {
            "name": "CategoryProducts",
            "kind": "OBJECT",
            "ofType": null,
            "fields": [
              {
                "name": "items",
                "description": "An array of products that are assigned to the category.",
                "type": {
                  "name": null,
                  "kind": "LIST",
                  "ofType": {
                    "name": "ProductInterface",
                    "kind": "INTERFACE"
                  },
                  "fields": null
                }
              },
              {
                "name": "page_info",
                "description": "An object that includes the page_info and currentPage values specified in the query.",
                "type": {
                  "name": "SearchResultPageInfo",
                  "kind": "OBJECT",
                  "ofType": null,
                  "fields": [
                    {
                      "name": "current_page",
                      "type": {
                        "name": "Int",
                        "kind": "SCALAR",
                        "ofType": null
                      }
                    },
                    {
                      "name": "page_size",
                      "type": {
                        "name": "Int",
                        "kind": "SCALAR",
                        "ofType": null
                      }
                    },
                    {
                      "name": "total_pages",
                      "type": {
                        "name": "Int",
                        "kind": "SCALAR",
                        "ofType": null
                      }
                    }
                  ]
                }
              },
              {
                "name": "total_count",
                "description": "The number of products returned.",
                "type": {
                  "name": "Int",
                  "kind": "SCALAR",
                  "ofType": null,
                  "fields": null
                }
              }
            ]
          }
        },
        {
          "name": "updated_at",
          "description": "Timestamp indicating when the category was updated.",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "url_key",
          "description": "The url key assigned to the category.",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "url_path",
          "description": "The url path assigned to the category.",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        },
        {
          "name": "url_suffix",
          "description": "The part of the category URL that is appended after the url key",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null,
            "fields": null
          }
        }
      ]
    }
  }
}`).data;
}
