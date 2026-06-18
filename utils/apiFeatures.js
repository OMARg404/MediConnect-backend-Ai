class APIFeatures {
    constructor(query, queryString) {
        this.query = query;
        this.queryString = queryString;
    }

    filter() {
        const queryObj = {...this.queryString };
        const excludedFields = ['page', 'sort', 'limit', 'fields'];
        excludedFields.forEach(el => delete queryObj[el]);

        let queryStr = JSON.stringify(queryObj);
        queryStr = queryStr.replace(/\b(gte|gt|lte|lt|ne|eq)\b/g, match => `$${match}`);

        const parsedFilter = JSON.parse(queryStr);
        const numberFields = ['Visitors', 'Rating', 'Revenue', 'id'];
        for (let key in parsedFilter) {
            if (numberFields.includes(key)) {
                if (typeof parsedFilter[key] === 'object') {
                    for (let op in parsedFilter[key]) {
                        parsedFilter[key][op] = Number(parsedFilter[key][op]);
                    }
                } else {
                    parsedFilter[key] = Number(parsedFilter[key]);
                }
            }
        }

        this.query = this.query.find(parsedFilter);
        return this;
    }

    sort() {
        if (this.queryString.sort) {
            const sortBy = this.queryString.sort.split(',').join(' ');
            this.query = this.query.sort(sortBy);
        } else {
            this.query = this.query.sort('id');
        }
        return this;
    }

    limitFields() {
        if (this.queryString.fields) {
            const fields = this.queryString.fields.split(',').join(' ');
            this.query = this.query.select(fields);
        } else {
            this.query = this.query.select('-__v');
        }
        return this;
    }

    paginate() {
        const page = parseInt(this.queryString.page) || 1;
        const limit = parseInt(this.queryString.limit) || 10000; // ← خليها عدد كبير عشان نتفادى التقسيم
        const skip = (page - 1) * limit;

        this.query = this.query.skip(skip).limit(limit);
        return this;
    }
}
module.exports = APIFeatures