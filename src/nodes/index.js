import createProductNodes from './products.js';
import createCategoryNodes from './categories.js';
import createStoreNode from './storeConfig.js';
import createCmsBlockNodes from './cmsBlocks.js';
import schema from '../schema';

export default async function createMagentoNodes(params, options) {
    const productMap = {};

    const indexMap = {
        product: {},
        category: {},
    };

    try {
        const config = await createStoreNode(params, options);

        await createProductNodes(
            params,
            { ...options, ...config },
            productMap,
            indexMap
        );

        await createCategoryNodes(
            params,
            { ...options, ...config },
            productMap,
            indexMap
        );
        
        await createCmsBlockNodes(params, { ...options, ...config }, indexMap);
    } catch (e) {
        console.error(e);
    }

    try {
        params.createTypes(schema);
    } catch (e) {
        console.error(e);
    }
}
