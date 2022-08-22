//require gas-local itself
var gas = require('gas-local');
//require your downloaded google apps script library from src subfolder as normal module   
var glib = gas.require('./src');
//call some function from your app script library 
glib.testerSql();