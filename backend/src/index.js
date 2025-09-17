const { getCookie, notFound } = require('./middleware/errorHandler');
const app = require('./app');
const port = process.env.PORT || 3001;

// Not Found
app.use('*', notFound);

getCookie();

app.listen(port, () => console.log('Backend running on http://localhost:' + port));