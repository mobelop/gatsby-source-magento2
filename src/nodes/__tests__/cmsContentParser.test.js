import cmsContentParser from '../cmsContentParser.js';

test('parses basic cms blocks', () => {
    // const res = cmsContentParser(
    //     `some html{{store url="about-us" some-other-attr="value2"}}end`
    // );
    // expect(res).toEqual([{ type: 'text', value: 'some html/about-usend' }]);

    const res2 = cmsContentParser(
        '<a href="{{store url="about-us"}}">About us</a><a href="{{store url="customer-service"}}">Customer Service</a>'
    );
    expect(res2).toEqual([{ type: 'text', value: '<a href="/about-us">About us</a><a href="/customer-service">Customer Service</a>' }]);
});
