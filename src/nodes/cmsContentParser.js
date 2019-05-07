/**
 * Parses cms blocks content into list of object
 */
export default function cmsContentParser(content, {media_url = '/'} = {}) {
    const resultNodes = [];
    const reg = /{{([^}]+)}}/g;

    let tagResult;
    let lastIdx = 0;
    while ((tagResult = reg.exec(content))) {
        const definition = tagResult[1];

        if (tagResult.index > lastIdx) {
            if(resultNodes.length && resultNodes[resultNodes.length - 1].type === 'text') {
                resultNodes[resultNodes.length - 1].value += content.substr(lastIdx, tagResult.index - lastIdx);
            } else {
                resultNodes.push({
                    type: 'text',
                    value: content.substr(lastIdx, tagResult.index - lastIdx),
                });
            }
        }

        lastIdx = tagResult.index + tagResult[0].length;

        const typeEnd = definition.indexOf(' ');
        if (typeEnd === -1) {
            continue;
        }

        const type = definition.substr(0, typeEnd);

        const node = {
            type,
        };

        const reg2 = /\s*([^=]+)="([^"]+)"/g;

        let attribute;
        while ((attribute = reg2.exec(definition.substr(typeEnd + 1)))) {
            const [_, key, value] = attribute;
            node[key] = value;
        }

        switch(node.type) {
            case 'store':
                if(resultNodes[resultNodes.length - 1].type === 'text') {
                    resultNodes[resultNodes.length - 1].value += '/' + (node['url'] ? node['url'].replace('.html', '') : '');
                }

                break;

            case 'media':
                if(resultNodes[resultNodes.length - 1].type === 'text') {
                    resultNodes[resultNodes.length - 1].value += media_url + node['url'];
                }

                break;

            default:
                resultNodes.push(node);

        }


    }

    if (lastIdx < content.length) {
        if(resultNodes && resultNodes.length && resultNodes[resultNodes.length - 1].type === 'text') {
            resultNodes[resultNodes.length - 1].value += content.substr(lastIdx);
        } else {
            resultNodes.push({
                type: 'text',
                value: content.substr(lastIdx),
            });
        }
    }

    return resultNodes;
}
