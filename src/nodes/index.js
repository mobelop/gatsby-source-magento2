import createProductNodes from './products.js';

export default async function createMagentoNodes(params, options) {
    await createProductNodes(params, options);
}
