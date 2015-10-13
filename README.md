# winston-groonga
A Winston transport for Groonga Database

## Installation

```bash
npm i --save winston winston-groonga
```

## Setup

```js
var winston = require('winston'),
    winstonGroonga = require('winston-groonga').Groonga

winston.add(winstonGroonga, {
  host: 'localhost',
  port: 5984,
  protocol: 'http'
  table: 'logs',
  severity: 'info'
})

or

winston.add(winstonGroonga, {
  protocol: 'http'
  url: 'your.path.url:port/path',
  table: 'logs',
  severity: 'info'
})

or

winston.add(winstonGroonga, {
  host: 'localhost',
  port: 5984,
  path: '/your/pathe/here',
  protocol: 'http'
  table: 'logs',
  severity: 'info'
})
```