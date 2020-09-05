import { convertMagentoSchemaToGatsby } from '../schema';
import { print } from 'graphql/language/printer';
import gql from 'graphql-tag';
import fullSchema from './__fullSchema.json';

xtest('converts single field type', () => {
    const schema = {
        productType: {
            name: 'ProductInterface',
            fields: [
                {
                    name: 'activity',
                    type: {
                        name: 'String',
                        kind: 'SCALAR',
                        fields: null,
                    },
                },
            ],
        },
    };

    const result = convertMagentoSchemaToGatsby(schema);
    const target = gql`
        type MagentoProduct {
            activity: String
        }
    `;

    expect(result).toEqual(print(target));

    // console.log('RESULTING SCHEMA:', result);
});

xtest('converts single non-null field type', () => {
    const schema = [
        {
            name: 'ProductInterface',
            fields: [
                {
                    name: 'city',
                    type: {
                        name: null,
                        kind: 'NON_NULL',
                        ofType: {
                            name: 'String',
                            kind: 'SCALAR',
                        },
                    },
                },
            ],
        },
    ];

    const result = convertMagentoSchemaToGatsby(schema);
    const target = gql`
        type MagentoProduct {
            city: String
        }
    `;

    expect(result).toEqual(print(target));

    // console.log('RESULTING SCHEMA:', result);
});

xtest('converts list field type', () => {
    const schema = {
        productType: {
            name: 'ProductInterface',
            fields: [
                {
                    name: 'categories',
                    description: 'The categories assigned to a product.',
                    type: {
                        name: null,
                        kind: 'LIST',
                        ofType: {
                            name: 'CategoryInterface',
                            kind: 'INTERFACE',
                        },
                        fields: null,
                    },
                },
            ],
        },
    };

    const result = convertMagentoSchemaToGatsby(schema);
    const target = gql`
        type MagentoProduct {
            categories: [MagentoCategory]
        }
    `;

    // console.log(JSON.stringify(target, 0, 4));

    expect(result).toEqual(print(target));

    // console.log('RESULTING SCHEMA:', result);
});

xtest('converts object field type', () => {
    const schema = [
        {
            name: 'ProductInterface',
            fields: [
                {
                    name: 'image',
                    type: {
                        name: 'ProductImage',
                        kind: 'OBJECT',
                        ofType: null,
                        fields: [
                            {
                                name: 'disabled',
                                type: {
                                    name: 'Boolean',
                                    kind: 'SCALAR',
                                    ofType: null,
                                    fields: null,
                                },
                            },
                        ],
                    },
                },
            ],
        },
    ];

    const result = convertMagentoSchemaToGatsby(schema);
    const target = gql`
        type MagentoProductImage {
            disabled: Boolean
        }
        type MagentoProduct {
            image: MagentoProductImage
        }
    `;

    // console.log(JSON.stringify(target, 0, 4));

    expect(result).toEqual(print(target));

    // console.log('RESULTING SCHEMA:', result);
});

test('converts full product schema', () => {
    const result = convertMagentoSchemaToGatsby(fullSchema.data.__schema.types);
    // const target = gql`
    //     type MagentoProductImage {
    //         disabled: Boolean
    //     }
    //     type MagentoProduct {
    //         image: MagentoProductImage
    //     }
    // `;
    //
    // console.log(JSON.stringify(target, 0, 4));

    // expect(result).toEqual(print(target));

    console.log('RESULTING SCHEMA:', result);
});
