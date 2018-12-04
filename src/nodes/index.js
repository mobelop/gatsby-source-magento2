import createProductNodes from './products.js';
import createStoreNode from "./storeConfig.js";

export default async function createMagentoNodes(params, options) {
    const config = await createStoreNode(params, options);
    await createProductNodes(params, {...options, ...config});
}
