const Server = require('static-server');

const PORT = process.env.PORT || 8000;

if (require.main === module) {
  const server = new Server({
    rootPath: '.',
    port: PORT,
    name: 'Hexagonal Awareness'
  });
  server.start(() => {
    console.log(`Listening on port ${PORT} lol...`);
  });
}
else if (module) {
  module.exports = require('./src/hexular');
}