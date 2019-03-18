import createProductNodes from './products.js';
import createCategoryNodes from './categories.js';
import createStoreNode from './storeConfig.js';

export default async function createMagentoNodes(params, options) {
    const productMap = {};

    const config = await createStoreNode(params, options);

    await createProductNodes(params, { ...options, ...config }, productMap);
    await createCategoryNodes(params, { ...options, ...config }, productMap);
}
