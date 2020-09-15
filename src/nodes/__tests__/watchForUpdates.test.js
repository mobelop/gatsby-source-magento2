// import { convertMagentoSchemaToGatsby } from '../schema';
// import { print } from 'graphql/language/printer';
// import gql from 'graphql-tag';
// import fullSchema from './__fullSchema.json';
// import allProductsQuery from '../../queries/products';
import { substituteQueryFieldsForCategory } from '../watchForUpdates';
import { print } from 'graphql/language/printer';
import gql from 'graphql-tag';

test('transforms category query', () => {
    const query = `
    query fetchCategory($id: Int!){
    category(id: $id) {
        children {
            id
            name
            description
    
            url_key
            url_path
        }
    }
}`;
    const targetQ = `
    query GetOneCategory($id: Int!) {
        category(id: $id) {
            id
        }
    }
`;

    const transformed = substituteQueryFieldsForCategory(query, targetQ);

    expect(transformed).toEqual(
        print(gql`
            query GetOneCategory($id: Int!) {
                category(id: $id) {
                    id
                    name
                    description
                    url_key
                    url_path
                }
            }
        `)
    );
});
