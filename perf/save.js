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
	.add('Mongoose', {
		defer: true,
		fn: deferred => {
			let cat = new Cat2({
				name: 'Tatoshka',
				age: 1,
				gender: '1',
				email: 'tatoshka@email.ru',
				phone: '+79991234567'
			});

			cat.save().then(() => {
				deferred.resolve();
			});
		}
	})
	.add('Mongorito', {
		defer: true,
		fn: deferred => {
			let cat = new Cat3({
				name: 'Tatoshka',
				age: 1,
				gender: '1',
				email: 'tatoshka@email.ru',
				phone: '+79991234567'
			});

			cat.save().then(() => {
				deferred.resolve();
			});
		}
	})
	.add('Maraquia', {
		defer: true,
		fn: deferred => {
			let cat = new Cat1({
				name: 'Tatoshka',
				age: 1,
				gender: '1',
				email: 'tatoshka@email.ru',
				phone: '+79991234567'
			});

			cat.save().then(() => {
				deferred.resolve();
			});
		}
	})
	.on('cycle', evt => {
		console.log(String(evt.target));
	})
	.run({ async: true });

// Mongoose x 1,125 ops/sec ±4.59% (69 runs sampled)
// Mongorito x 1,596 ops/sec ±4.08% (69 runs sampled)
// Maraquia x 1,143 ops/sec ±3.39% (73 runs sampled)
