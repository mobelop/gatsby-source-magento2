import { print } from 'graphql/language/printer';
import { Kind } from 'graphql';
import gql from 'graphql-tag';
import { rawRequest } from 'graphql-request';

export function convertMagentoSchemaToGatsby(query, schema) {
    const typeMap = buildTypeMap(schema);

    const result = {
        kind: Kind.DOCUMENT,
        definitions: [],
    };

    const context = {
        typeMap,
        result,
        stack: [],
        defs: {},
    };

    const parsedQuery = gql(query);

    for (const definition of parsedQuery.definitions) {
        if (definition.kind === Kind.OPERATION_DEFINITION) {
            let selection =
                definition.selectionSet.selections[0].selectionSet
                    .selections[0];

            context.stack.push({
                field: {
                    name: 'items',
                    type: {
                        kind: 'OBJECT',
                        name: 'ProductInterface',
                        ofType: null,
                    },
                },
                selection,
            });

            scanSelections(context, selection);
        }
    }

    return print(result);
}

function scanSelections(context, definition, fragment = null) {
    const { defs } = context;

    const {
        selectionSet: { selections },
    } = definition;

    const fields = [];

    for (const selection of selections) {
        if (selection.kind === 'InlineFragment') {
            context.stack.push({
                field: {
                    name: 'fragment_' + selection.typeCondition.name.value,
                    type: {
                        kind: 'OBJECT',
                        name: selection.typeCondition.name.value,
                        ofType: null,
                    },
                },
                selection,
            });

            const subFields = scanSelections(context, selection, true);

            context.stack.pop();

            // merge fragment fields into current type
            fields.push(...subFields);

            continue;
        }
        if (!selection.name) {
            console.log('selection.name is null for:', selection);
            continue;
        }

        if (selection.selectionSet) {
            const field = findField(context, selection);

            context.stack.push({
                field,
                selection,
            });

            const def = scanSelections(context, selection);

            context.stack.pop();

            const newField = genNamedFieldDef(context, def, selection);
            fields.push(newField);
        } else {
            if (selection.name.value !== '__typename') {
                const field = genField(context, selection);
                fields.push(field);
            }
        }
    }

    if (fragment) {
        return fields;
    }

    if (fields.length) {
        const typeName = getTypeNameFor(context);

        const definition = {
            kind: 'ObjectTypeDefinition',
            name: {
                kind: 'Name',
                value: typeName,
            },
            fields,
        };

        if (typeName === 'MagentoProduct') {
            definition.interfaces = [
                { kind: 'NamedType', name: { kind: 'Name', value: 'Node' } },
            ];
            definition.directives = [
                {
                    kind: 'Directive',
                    name: { kind: 'Name', value: 'dontInfer' },
                },
            ];

            fields.push(...nodeFields);
        }

        if (!defs[typeName]) {
            context.result.definitions.push(definition);
            defs[typeName] = definition;
        }

        return definition;
    }
}

function getCurrentField(context) {
    const { stack } = context;
    const { field } = stack[stack.length - 1];
    return field;
}

function getCurrentSelection(context) {
    const { stack } = context;
    const { selection } = stack[stack.length - 1];
    return selection;
}

function getCurrentType(context) {
    const field = getCurrentField(context);

    if (!field) {
        console.error('Field is null in context:', context);
        throw new Error(`Field is null in context!`);
    }

    if (!field.type) {
        console.error('Field.type is null in field:', field);
        throw new Error(`Field.type is null in field!`);
    }

    if (field.type.kind === 'OBJECT' || field.type.kind === 'INTERFACE') {
        return field.type.name;
    } else if (field.type.kind === 'LIST') {
        return field.type.ofType.name;
    } else {
        return 'UnknownType';
    }
}

function getTypeNameFor(context) {
    const { stack } = context;
    const field = getCurrentField(context);

    if (field.name === 'items' && stack.length > 0) {
        const result =
            'Magento' + getCurrentType(context).replace('Interface', '');

        return result;
    }

    let name = ['Magento'];

    for (let i = 0; i < stack.length; i++) {
        const item = stack[i];
        const { field } = item;

        if (i > 0) {
            name.push(capitalizeFirstLetter(snakeToCamel(field.name)));
        } else {
            name.push(field.type.name.replace('Interface', ''));
        }
    }

    const result = name.join('');
    return result;
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

function genNamedFieldDef(context, def, selection) {
    const field = findField(context, selection);
    let defType = def.name.value;

    // MagentoProductImage fields will be converted to the File nodes
    if (defType === 'MagentoProductImage') {
        return {
            kind: 'FieldDefinition',
            name: {
                kind: 'Name',
                value: selection.name.value,
            },
            arguments: [],
            type: {
                kind: 'NamedType',
                name: {
                    kind: 'Name',
                    value: 'File',
                },
            },
            directives: [
                {
                    kind: 'Directive',
                    name: {
                        kind: 'Name',
                        value: 'link',
                    },
                    arguments: [
                        {
                            kind: 'Argument',
                            name: {
                                kind: 'Name',
                                value: 'from',
                            },
                            value: {
                                kind: 'StringValue',
                                // name of the foreign key field
                                value: 'image___NODE',
                                block: false,
                            },
                        },
                    ],
                },
            ],
        };
    }

    if (field.type.kind === 'LIST') {
        return {
            kind: 'FieldDefinition',
            name: {
                kind: 'Name',
                value: selection.name.value,
            },
            type: {
                kind: 'ListType',
                type: {
                    kind: 'NamedType',
                    name: {
                        kind: 'Name',
                        value: defType,
                    },
                },
            },
        };
    } else {
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
                    value: defType,
                },
            },
        };
    }
}

function findField(context, selection) {
    const { typeMap } = context;
    const typeName = getCurrentType(context);
    const fieldName = selection.name.value;
    let type = typeMap[typeName];
    if (!type) {
        throw Error(`can't find type: ${typeName}`);
    }
    const { fields } = type;

    for (const field of fields) {
        if (field.name === fieldName) {
            return field;
        }
    }

    throw Error(`couldn't find field ${fieldName} on types ${typeName}`);
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

const introspectionQuery = `
    {
        __schema {
            types {
                ...FullType
            }
        }
    }

    fragment FullType on __Type {
        kind
        name
        fields(includeDeprecated: true) {
            name
            type {
                ...TypeRef
            }
        }
        interfaces {
            ...TypeRef
        }
        possibleTypes {
            ...TypeRef
        }
    }

    fragment TypeRef on __Type {
        kind
        name
        ofType {
            kind
            name
            ofType {
                kind
                name
                ofType {
                    kind
                    name
                    ofType {
                        kind
                        name
                        ofType {
                            kind
                            name
                            ofType {
                                kind
                                name
                                ofType {
                                    kind
                                    name
                                }
                            }
                        }
                    }
                }
            }
        }
    }
`;

export async function getRemoteGraphQLSchema(config) {
    try {
        const { graphqlEndpoint } = config;
        const {
            data: { __schema },
            errors,
        } = await rawRequest(graphqlEndpoint, introspectionQuery);

        return __schema;
    } catch (e) {
        if (e.response) {
            const { errors = [] } = e.response;
            logErrors(errors);
        }
    }
}

function logErrors(errors) {
    if (errors && errors.length) {
        console.error(
            'ERRORS while querying products:',
            JSON.stringify(errors, undefined, 4)
        );
    }
}

// Fields required by interface Node
const nodeFields = [
    {
        kind: 'FieldDefinition',
        name: {
            kind: 'Name',
            value: 'id',
        },
        arguments: [],
        type: {
            kind: 'NonNullType',
            type: {
                kind: 'NamedType',
                name: {
                    kind: 'Name',
                    value: 'ID',
                },
            },
        },
        directives: [],
    },
    {
        kind: 'FieldDefinition',
        name: {
            kind: 'Name',
            value: 'parent',
        },
        arguments: [],
        type: {
            kind: 'NamedType',
            name: {
                kind: 'Name',
                value: 'Node',
            },
        },
        directives: [],
    },
    {
        kind: 'FieldDefinition',
        name: {
            kind: 'Name',
            value: 'children',
        },
        arguments: [],
        type: {
            kind: 'NonNullType',
            type: {
                kind: 'ListType',
                type: {
                    kind: 'NonNullType',
                    type: {
                        kind: 'NamedType',
                        name: {
                            kind: 'Name',
                            value: 'Node',
                        },
                    },
                },
            },
        },
        directives: [],
    },
    {
        kind: 'FieldDefinition',
        name: {
            kind: 'Name',
            value: 'internal',
        },
        arguments: [],
        type: {
            kind: 'NonNullType',
            type: {
                kind: 'NamedType',
                name: {
                    kind: 'Name',
                    value: 'Internal',
                },
            },
        },
        directives: [],
    },
];
