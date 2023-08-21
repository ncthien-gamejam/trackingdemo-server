const express = require('express')
const path = require('path')

const PORT = process.env.PORT || 5001

var app = express();

app.get('/', function (req, res) {
   res.send('Hello World');
})

app.put('/events', function (req, res) {
  res.json({ message: "ok" });
})

app.use(express.static(path.join(__dirname, 'public')))
    
app.listen(PORT, () => console.log(`Listening on ${ PORT }`))
