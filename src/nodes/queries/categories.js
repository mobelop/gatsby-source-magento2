const categoryQuery = `
query fetchCategory($id: Int!){
    category(id: $id) {
        children {
            id
            name
            description
    
            url_key
            url_path
            
            image
    
            children_count
            position
    
            level
            product_count
            default_sort_by
            meta_title
            meta_keywords
            meta_description
            landing_page
            is_anchor
            include_in_menu
            filter_price_range
            display_mode
            available_sort_by
            
            breadcrumbs {
                category_id
                category_name
                category_level
                category_url_key
            }
            
            products(pageSize: 10000) {
                items {
                    id
                }
            }
            
            path
            path_in_store
    
        }
    }
}`;

export default categoryQuery;
