/**
 * Array paginator function
 * @param  array  Input array
 * @param  page_size  Default page size
 * @param  page_number  Page number to paginate to
 */
const paginate = (array, page_size, page_number) => {
    return array.slice((page_number - 1) * page_size, page_number * page_size);
};

module.exports.paginate = paginate;