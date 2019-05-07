import cmsContentParser from '../cmsContentParser.js';

test('parses basic cms blocks', () => {
    const res = cmsContentParser(
        '<a href="{{store url="about-us"}}">About us</a><a href="{{store url="customer-service"}}">Customer Service</a>'
    );
    expect(res).toEqual([{ type: 'text', value: '<a href="/about-us">About us</a><a href="/customer-service">Customer Service</a>' }]);
});

test('parses basic cms blocks', () => {
    const res = cmsContentParser(
        '<p>text</p>'
    );
    expect(res).toEqual([{ type: 'text', value: '<p>text</p>' }]);
});
