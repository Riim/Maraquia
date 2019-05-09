# Maraquia -- a simple ORM for MongoDB

## Установка

```
npm i -S maraquia
```

## Настройка соединения

Есть два способа, здесь рассмотрим более простой: в папке проекта создаём файл `config/maraquia.json` в который добавляем следующее:
```json
{
	"databaseUrl": "mongodb://localhost:27017/",
	"databaseName": "Test"
}
```

## Использование

### Сохранение в БД

Простой пример отношения one-to-many со ссылкой только в одну сторону:
```js
import { BaseModel, Field, Model } from 'maraquia';

@Model({
	collectionName: 'Pet'
})
class Pet extends BaseModel {
	@Field() name: string | null;
}

@Model({
	collectionName: 'Owner'
})
class Owner extends BaseModel {
	@Field() name: string | null;
	@Field(() => Pet) pets: Promise<Array<Pet> | null>;
}

(async () => { // в следующих примерах я буду опускать эту строчку

let pet = new Pet({
	name: 'Tatoshka'
});

let owner = new Owner({
	name: 'Dmitry',
	pets: [pet]
});

await owner.save();

})();
```

В БД появятся две коллекции `Pet` и `Owner` с записями:
```json
{
	"_id": "5a...1f44",
	"name": "Tatoshka"
}
```
и
```json
{
	"_id": "5a...1f43",
	"name": "Dmitry",
	"pets": ["5a...1f44"]
}
```

Метод `save` был вызван только на модели `owner`, Maraquia как и положено сама позаботилась о сохранении второго документа.

Усложним пример, теперь отношение many-to-many и ссылки в обе стороны:
```js
@Model({
	collectionName: 'User'
})
class User extends BaseModel {
	@Field() name: string | null;
	@Field(() => Group) groups: Promise<Array<Group> | null>;
}

@Model({
	collectionName: 'Group'
})
class Group extends BaseModel {
	@Field() name: string | null;
	@Field(() => User) users: Promise<Array<User> | null>;
}

let user1 = new User({
	name: 'Dmitry'
});
let user2 = new User({
	name: 'Tatoshka'
});

let group1 = new Group({
	name: 'Admins',
	users: [user1]
});
let group2 = new Group({
	name: 'Moderators',
	users: [user1, user2]
});

user1.groups = [group1, group2] as any;
user2.groups = [group2] as any;

await group1.save();
```

В БД появится коллекция `User` с записями:
```json
{
	"_id": "5a...c56f",
	"name": "Dmitry",
	"groups": ["5a...c56e", "5a...c570"]
}

{
	"_id": "5a...c571",
	"name": "Tatoshka",
	"groups": ["5a...c570"]
}
```

и коллекция `Group` с записями:
```json
{
	"_id": "5a...c56e",
	"name": "Admins",
	"users": ["5a...c56f"]
}

{
	"_id": "5a...c570",
	"name": "Moderators",
	"users": ["5a...c56f", "5a...c571"]
}
```

Вы, наверное, уже заметили отсутствие декораторов с именами вроде `hasOne`, `hasMany`, `belongsTo` как это обычно принято для ORM. Maraquia справляется без этой дополнительной информации, hasOne или hasMany определяется значением, массив -- значит hasMany. А встроенный документ или внешний (сохраняется в отдельной коллекции) определяется наличием в его схеме заполненного `collectionName`. Например, если в первом примере закомментировать строку `collectionName: 'Pet'` и вновь запустить его, то запись появится только в коллекции `Owner` и будет выглядеть так:
```json
{
	"_id": "5b...ec43",
	"name": "Dmitry",
	"pets": [{
		"name":"Tatoshka"
	}]
}
```

Кроме того тип поля `pets` перестаёт быть промисом.
То есть с помощью Maraquia можно также удобно работать и со встраиваемыми документами.

### Чтение из БД

Попробуем прочитать из базы что-то из ранее сохранённого:
```js
let user = User.findOne<User>({ name: 'Dmitry' });

console.log(user instanceof User); // true

console.log(user.name); // 'Dmitry'
console.log(await user.groups); // [Group { name: 'Admins', ... }, Group { name: 'Moderators', ... }]
```

При чтении поля `groups` было использовано ключевое слово `await` -- внешние документы достаются из бызы лениво при первом чтении соответствующего поля.

Но что если необходимо иметь доступ к идентификаторам хранящимся в поле без вытаскивания соответствующих им документов из БД, но при этом опционально может понадобиться и вытащить их? Имя поля в модели соответствует имени поля в документе, но используя опцию `dbFieldName` для поля можно изменить это соответствие. То есть определив два поля в модели ссылающихся на одно поле в документе и не указав тип для одного из них можно решить эту проблему:
```js
@Model({
	collectionName: 'Group'
})
class Group extends BaseModel {
	@Field({ dbFieldName: 'users' })
	readonly userIds: Array<ObjectId> | null; // здесь будут идентификаторы

	@Field(() => User)
	users: Promise<Array<User> | null>; // а здесь инстансы пользователей по идентификаторам
}
```

### Удаление документа

Метод `remove` удаляет соответствующий документ из БД. Maraquia не знает где есть ссылки на него и здесь программисту необходимо поработать самому:
```js
@Model({
	collectionName: 'User'
})
class User extends BaseModel {
	@Field() name: string | null;

	@Field({ dbFieldName: 'groups' })
	groupIds: Array<ObjectId> | null;

	@Field(() => Group)
	groups: Promise<Array<Group> | null>;
}

@Model({
	collectionName: 'Group'
})
class Group extends BaseModel {
	@Field() name: string | null;

	@Field({ dbFieldName: 'users' })
	userIds: Array<ObjectId> | null;

	@Field(() => User)
	users: Promise<Array<User> | null>;
}

let user = (await User.findOne<User>({ name: 'Tatoshka' }))!;

// удаляем ссылки на документ
for (let group of await Group.find<Group>({ _id: { $in: user.groupIds } })) {
	group.userIds = group.userIds!.filter(
		userId => userId.toHexString() != user._id!.toHexString()
	);

	await group.save();
}

// удаляем сам документ
await user.remove();
```

В данном примере массив `userIds` был заменён на новый, созданный методом `Array#filter`, но можно менять существующий массив, Maraquia находит и такие изменения. В данном случае получится так:
```js
group.userIds!.splice(
	group.userIds!.findIndex(userId => userId.toHexString() == user._id!.toHexString()),
	1
);
```

### Валидация

Для валидации поля необходимо добавить свойство `validate` в его опции:
```ts
@Model({
	collectionName: 'User'
})
class User extends BaseModel {
	@Field({
		validate: value => typeof value == 'string' && value.trim().length >= 2
	})
	name: string | null;

	@Field({
		validate: value => {
			// При false сообщение об ошибке сформируется автоматически:
			return typeof value == 'number' && value >= 0;

			// Или можно задать его самостоятельно:
			if (typeof value != 'number' || value < 0) {
				return 'Что-то пошло не так';
				// или так:
				return new TypeError('Что-то пошло не так');
				// или так:
				throw new TypeError('Что-то пошло не так');
			}
		}
	})
	age: number | null;

	@Field(() => Account, {
		validate: value => !!value
	})
	/*
	тоже самое что и:
	@Field({
		type: () => Account,
		validate: value => !!value
	})
	*/
	account: Promise<Account | null>;
}
```

Так же можно передавать объекты создаваемые библиотекой [joi](https://www.npmjs.com/package/joi):
```js
import * as joi from 'joi';

@Model({
	collectionName: 'User'
})
class User extends BaseModel {
	@Field({
		validate: joi.string().min(2)
	})
	name: string | null;

	@Field({
		validate: joi.number().min(0)
	})
	age: number | null;
}
```

### Хуки

Следующие методы срабатывают согласно их названию: `beforeSave`, `afterSave`, `beforeRemove`, `afterRemove`.

### Использование с javascript

Typescript -- это здорово, но иногда надо без него. Для этого вместо объекта передаваемого декоратору `Model` необходимо определить статическое поле `$schema`, в котором есть также поле `fields`:
```js
const { BaseModel } = require('maraquia');

class Pet extends BaseModel {
}
Pet.$schema = {
	collectionName: 'Pet',
	fields: {
		name: {}
	}
};

class Owner extends BaseModel {
}
Owner.$schema = {
	collectionName: 'Owner',
	fields: {
		name: {},
		pets: { type: () => Pet }
	}
};

let pet = new Pet({
	name: 'Tatoshka'
});

let owner = new Owner({
	name: 'Dmitry',
	pets: [pet]
});

await owner.save();
```

Запись в поля делается через метод `setField`:
```js
pet.setField('name', 'Tosha');
```

А чтение полей с внешними документами через метод `fetchField`:
```js
await owner.fetchField('pets');
```

Остальные поля читаются как обычно.

## Производительность

Я написал парочку простых бенчмарков для сравнения производительности с Mongoose и Mongorito. В первом просто создаются экземпляры модели. Для всех троих это выглядит одинаково:
```js
let cat = new Cat({
	name: 'Tatoshka',
	age: 1,
	gender: '1',
	email: 'tatoshka@email.ru',
	phone: '+79991234567'
});
```

Результат (больше -- лучше):
```
Mongoose x 41,382 ops/sec ±7.38% (78 runs sampled)
Mongorito x 28,649 ops/sec ±3.20% (85 runs sampled)
Maraquia x 1,312,816 ops/sec ±1.70% (87 runs sampled)
```

Во втором тоже самое, но с сохранением в БД. Результат:
```
Mongoose x 1,125 ops/sec ±4.59% (69 runs sampled)
Mongorito x 1,596 ops/sec ±4.08% (69 runs sampled)
Maraquia x 1,143 ops/sec ±3.39% (73 runs sampled)
```

Исходники в папке [perf](https://github.com/Riim/Maraquia/tree/master/perf).
