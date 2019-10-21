# Maraquia -- a simple ORM for MongoDB

После прочтения заголовка у многих наверняка возникает вопрос -- зачем ещё один велосипед при наличии уже обкатанных Mongoose, Mongorito, TypeORM и т. д.? Для ответа нужно разобраться в чём отличие ORM от ODM. Смотрим википедию:

> ORM (англ. Object-Relational Mapping, рус. объектно-реляционное отображение, или преобразование) — технология программирования, которая связывает базы данных с концепциями объектно-ориентированных языков программирования, создавая «виртуальную объектную базу данных».

То есть ORM -- это именно про реляционное представление данных. Напомню, в реляционных БД нет возможности просто взять и встроить документ в поле другого документа (в этой статье записи таблиц тоже называются документами, хоть это и некорректно), можно конечно хранить в поле JSON в виде строки, но индекс по данным в нём сделать не выйдет. Вместо этого используются "ссылки" -- в поле, где должен быть вложенный документ, вместо него записывается его идентификатор, а сам документ с этим идентификатором сохраняется в соседней таблице. ORM умеет работать с такими ссылками -- записи по ним автоматически сразу или лениво забираются из БД, а при сохранении не нужно сперва сохранять дочерний документ, брать назначенный ему идентификатор, записывать его в поле родительского документа и только после этого сохранять родительский документ. Нужно просто попросить ORM сохранить родительский документ и всё что с ним связано, а он (object-relational mapper) уже сам разберётся как это правильно сделать. ODM же наоборот, не умеет работать с такими ссылками, зато знает про встроенные документы.

Думаю отличия примерно понятны, так вот всё перечисленное выше является именно ODM. Даже TypeORM при работе с MongoDB имеет некоторые ограничения (https://github.com/typeorm/typeorm/issues/655) которые делают его опять же обычным ODM.

И тут вы спросите -- а зачем? Зачем работая с документоориентированной БД мне понадобились какие-то ссылки? Есть минимум одна простая, но часто встречающаяся ситуация когда они всё же необходимы: на дочерний документ указывают несколько родительских, здесь можно каждому родительскому записать по копии дочернего и потом страдать обеспечивая консистентность данных в этих копиях, а можно просто сохранить дочерний документ в отдельной коллекции, а всем родителям дать ссылку на него (можно ещё в дочерний встраивать родительский, но это не всегда возможно, во-первых, отношение может быть many-to-many, во-вторых, дочерний тип может быть слишком второстепенен в системе и завтра может вообще исчезнуть из БД, встраивать в него что-то ключевое совсем не хочется).

Долгое время я работал с RethinkDB для которого есть несколько неплохих ORM ([thinky](https://github.com/neumino/thinky), [requelize](https://github.com/buckless/requelize), ...), но последнее время активность разработки этой БД совсем уж вызывает уныние. Я решил посмотреть в сторону MongoDB и первое чего я __не__ обнаружил, это подобных пакетов. Почему бы не написать самому, это будет довольно интересный опыт, подумал я и, встречайте -- Maraquia.

## Установка

```
npm i -S maraquia
```

При использовании с typescript необходимо также добавить `"experimentalDecorators": true` в `tsconfig.json`.

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

При чтении поля `groups` было использовано ключевое слово `await` -- внешние документы достаются из базы лениво при первом чтении соответствующего поля.

Но что если необходимо иметь доступ к идентификаторам хранящимся в поле без вытаскивания соответствующих им документов из БД, но при этом опционально может понадобиться и вытащить их? Имя поля в модели соответствует имени поля в документе, но используя опцию `dbFieldName` можно изменить это соответствие. То есть определив два поля в модели ссылающихся на одно поле в документе и не указав тип для одного из них можно решить эту проблему:
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

В данном примере массив `userIds` был заменён на новый, созданный методом `Array#filter`, но можно менять существующий массив, Maraquia находит и такие изменения. То есть можно было так:
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
