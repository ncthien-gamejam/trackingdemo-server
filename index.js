const express = require('express')
const path = require('path')

const PORT = process.env.PORT || 5001

var app = express();

app.use(express.static(path.join(__dirname, 'public')))
    
app.listen(PORT, () => console.log(`Listening on ${ PORT }`))
