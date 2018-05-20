const Benchmark = require('benchmark');

const { BaseModel } = require('../dist');
const Mongoose = require('mongoose');
const Mongorito = require('mongorito');

const mongoritoDB = new Mongorito('mongodb://localhost:27017/MongoritoTest');

Mongoose.connect('mongodb://localhost:27017/MongooseTest');

const suite = new Benchmark.Suite();

class Cat1 extends BaseModel {}

Cat1.$schema = {
	collectionName: 'Cat',

	fields: {
		name: {},
		age: {},
		gender: {},
		email: {},
		phone: {}
	}
};

const Cat2 = Mongoose.model('Cat', {
	name: String,
	age: Number,
	gender: Number,
	email: String,
	phone: String
});

class Cat3 extends Mongorito.Model {}
mongoritoDB.register(Cat3);

mongoritoDB.connect();

suite
	.add('Mongoose', () => {
		let cat = new Cat2({
			name: 'Tatoshka',
			age: 1,
			gender: '1',
			email: 'tatoshka@email.ru',
			phone: '+79991234567'
		});
	})
	.add('Mongorito', () => {
		let cat = new Cat3({
			name: 'Tatoshka',
			age: 1,
			gender: '1',
			email: 'tatoshka@email.ru',
			phone: '+79991234567'
		});
	})
	.add('Maraquia', () => {
		let cat = new Cat1({
			name: 'Tatoshka',
			age: 1,
			gender: '1',
			email: 'tatoshka@email.ru',
			phone: '+79991234567'
		});
	})
	.on('cycle', evt => {
		console.log(String(evt.target));
	})
	.run({ async: true });

// Mongoose x 41,382 ops/sec ±7.38% (78 runs sampled)
// Mongorito x 28,649 ops/sec ±3.20% (85 runs sampled)
// Maraquia x 1,312,816 ops/sec ±1.70% (87 runs sampled)
