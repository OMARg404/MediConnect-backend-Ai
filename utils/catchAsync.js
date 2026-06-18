// utils/catchAsync.js

module.exports = fn => {
    return (req, res, next) => {
        fn(req, res, next).catch(next); // لو حصل error بيتبعت لـ next() علطول
    };
};