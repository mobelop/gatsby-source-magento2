const categoryQuery = `query($ids: [String]) {
    gatsbyCmsBlocks(identifiers: $ids)
    {
        items
        {
            identifier
            title
            content
        }
    }
}`;

export default categoryQuery;
