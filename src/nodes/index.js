import createProductNodes from './products.js';
import createCategoryNodes from './categories.js';
import createStoreNode from './storeConfig.js';
import createCmsBlockNodes from './cmsBlocks.js';
import watchForUpdates from './watchForUpdates';

export default async function createMagentoNodes(params, options) {
    const productMap = {};

    const indexMap = {
        product: {},
        category: {},
    };

    const importMaps = {
        productMap,
        indexMap,
    };

    const config = await createStoreNode(params, options);

    await createProductNodes(params, { ...options, ...config }, importMaps);
    await createCategoryNodes(
        params,
        { ...options, ...config },
        productMap,
        indexMap
    );
    
    // await createCmsBlockNodes(params, { ...options, ...config }, indexMap);
    watchForUpdates(params, { ...options, ...config }, importMaps);
}
