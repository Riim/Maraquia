import * as joi from 'joi';
import { ObjectId } from 'mongodb';
import {
	BaseModel,
	Field,
	getDefaultInstance,
	Model
	} from '../src';

afterEach(() => {
	getDefaultInstance().then(m => m.db.dropDatabase());
});

describe('create', () => {
	test('null по умолчанию', () => {
		@Model()
		class User extends BaseModel {
			@Field() name: string | null;
		}

		let user = new User();

		expect(user.name).toBe(null);
	});

	test('заменяет undefined на null', () => {
		@Model()
		class User extends BaseModel {
			@Field() name: string | null;
		}

		let user = new User({ name: undefined });

		expect(user.name).toBe(null);

		user.name = undefined as any;

		expect(user.name).toBe(null);
	});

	test('заменяет пустой массив на null', () => {
		@Model()
		class User extends BaseModel {
			@Field() name: string | null;
		}

		let user = new User({ name: [] });

		expect(user.name).toBe(null);

		user.name = [] as any;

		expect(user.name).toBe(null);
	});

	test('поле идентификаторов получает значение не наследующее от BaseModel', () => {
		@Model({
			collectionName: 'User'
		})
		class User extends BaseModel {}

		@Model({
			collectionName: 'Group'
		})
		class Group extends BaseModel {
			@Field({ dbFieldName: 'users' })
			userIds: Array<ObjectId> | null;

			@Field(() => User)
			users: Promise<Array<User> | null>;
		}

		let user = new User();
		user._id = new ObjectId();

		let group = new Group({
			users: [user._id]
		});

		expect(group.userIds![0]).toBe(user._id);
	});

	test('поле идентификаторов не получает значение наследующее от BaseModel', () => {
		@Model({
			collectionName: 'User'
		})
		class User extends BaseModel {}

		@Model({
			collectionName: 'Group'
		})
		class Group extends BaseModel {
			@Field({ dbFieldName: 'users' })
			userIds: Array<ObjectId> | null;

			@Field(() => User)
			users: Promise<Array<User> | null>;
		}

		let user = new User();

		let group = new Group({
			users: [user]
		});

		expect(group.userIds).toBe(null);
	});

	test('поле идентификатора не получает значение наследующее от BaseModel', () => {
		@Model({
			collectionName: 'Account'
		})
		class Account extends BaseModel {}

		@Model({
			collectionName: 'User'
		})
		class User extends BaseModel {
			@Field({ dbFieldName: 'account' })
			accountId: ObjectId | null;

			@Field(() => Account)
			account: Promise<Account | null>;
		}

		let account = new Account();

		let user = new User({
			account
		});

		expect(user.accountId).toBe(null);
	});

	test('создаёт встроенный документ', () => {
		@Model()
		class Account extends BaseModel {
			@Field() accessLevel: number | null;
		}

		@Model({
			collectionName: 'User'
		})
		class User extends BaseModel {
			@Field() name: string | null;

			@Field(() => Account)
			account: Account;
		}

		let user = new User({
			name: 'Dmitry',
			account: {
				accessLevel: 9
			}
		});

		expect(user.account).toBeInstanceOf(Account);
		expect(user.account.accessLevel).toBe(9);
	});

	test('создаёт внешний документ', async () => {
		@Model({
			collectionName: 'Account'
		})
		class Account extends BaseModel {
			@Field() accessLevel: number | null;
		}

		@Model({
			collectionName: 'User'
		})
		class User extends BaseModel {
			@Field() name: string | null;

			@Field(() => Account)
			account: Promise<Account>;
		}

		let user = new User({
			name: 'Dmitry',
			account: {
				accessLevel: 9
			}
		});

		let account = await user.account;

		expect(account).toBeInstanceOf(Account);
		expect(account.accessLevel).toBe(9);
	});

	test('создаёт встроенные документы', () => {
		@Model()
		class Pet extends BaseModel {
			@Field() name: string | null;
		}

		@Model({
			collectionName: 'Owner'
		})
		class Owner extends BaseModel {
			@Field() name: string | null;

			@Field(() => Pet)
			pets: Array<Pet> | null;
		}

		let owner = new Owner({
			name: 'Dmitry',
			pets: [
				{
					name: 'Tatoshka'
				}
			]
		});

		expect(owner.pets!.length).toBe(1);
		expect(owner.pets![0]).toBeInstanceOf(Pet);
		expect(owner.pets![0].name).toBe('Tatoshka');
	});

	test('создаёт внешние документы', async () => {
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

			@Field(() => Pet)
			pets: Promise<Array<Pet> | null>;
		}

		let owner = new Owner({
			name: 'Dmitry',
			pets: [
				{
					name: 'Tatoshka'
				}
			]
		});

		let pets = (await owner.pets)!;

		expect(pets.length).toBe(1);
		expect(pets[0]).toBeInstanceOf(Pet);
		expect(pets[0].name).toBe('Tatoshka');
	});
});

describe('update', () => {
	test('заменяет undefined на null', () => {
		@Model()
		class User extends BaseModel {
			@Field() name: string | null;
		}

		let user = new User();

		user.setField('name', undefined);

		expect(user.name).toBeNull();
	});

	test('заменяет пустой массив на null', () => {
		@Model()
		class User extends BaseModel {
			@Field() name: string | null;
		}

		let user = new User();

		user.setField('name', []);

		expect(user.name).toBeNull();
	});
});

describe('save', () => {
	test('simple save', async () => {
		@Model({
			collectionName: 'User'
		})
		class User extends BaseModel {
			@Field() name: string | null;
		}

		let user = new User({
			name: 'Dmitry'
		});

		await user.save();

		let userDoc = await user.m.db.collection('User').findOne({});

		expect(userDoc).toMatchObject({ name: 'Dmitry' });
	});

	test('embedded', async () => {
		@Model()
		class Pet extends BaseModel {
			@Field() name: string | null;
		}

		@Model({
			collectionName: 'Owner'
		})
		class Owner extends BaseModel {
			@Field() name: string | null;
			@Field(() => Pet)
			pets: Promise<Array<Pet> | null>;
		}

		let pet = new Pet({
			name: 'Tatoshka'
		});

		let owner = new Owner({
			name: 'Dmitry',
			pets: [pet]
		});

		await owner.save();

		let ownerDoc = await owner.m.db.collection('Owner').findOne({});

		expect(ownerDoc).toMatchObject({
			name: 'Dmitry',
			pets: [{ name: 'Tatoshka' }]
		});
	});

	test('hooks', async () => {
		let beforeSave = jest.fn();
		let afterSave = jest.fn();

		@Model({
			collectionName: 'User'
		})
		class User extends BaseModel {
			@Field() name: string | null;

			beforeSave = beforeSave;
			afterSave = afterSave;
		}

		let user = new User({
			name: 'Dmitry'
		});

		await user.save();

		expect(beforeSave).toHaveBeenCalledTimes(1);
		expect(afterSave).toHaveBeenCalledTimes(1);
	});

	test('one to one', async () => {
		@Model({
			collectionName: 'User'
		})
		class User extends BaseModel {
			@Field() name: string | null;
		}

		@Model({
			collectionName: 'Account'
		})
		class Account extends BaseModel {
			@Field(() => User)
			owner: Promise<User | null>;
		}

		let user = new User({
			name: 'Dmitry'
		});

		let account = new Account({
			owner: user
		});

		await account.save();

		let userDoc = await account.m.db.collection('User').findOne({});
		let accountDoc = await account.m.db.collection('Account').findOne({});

		expect(userDoc).toMatchObject({
			_id: accountDoc.owner,
			name: 'Dmitry'
		});
		expect(accountDoc).toMatchObject({ owner: userDoc._id });
	});

	test('two-way one to one', async () => {
		@Model({
			collectionName: 'User'
		})
		class User extends BaseModel {
			@Field() name: string | null;

			@Field(() => Account)
			account: Promise<Account | null>;
		}

		@Model({
			collectionName: 'Account'
		})
		class Account extends BaseModel {
			@Field(() => User)
			owner: Promise<User | null>;
		}

		let user = new User({
			name: 'Dmitry'
		});

		let account = new Account({
			owner: user
		});

		user.account = account as any;

		await user.save();

		let userDoc = await user.m.db.collection('User').findOne({});
		let accountDoc = await user.m.db.collection('Account').findOne({});

		expect(userDoc).toMatchObject({
			_id: accountDoc.owner,
			name: 'Dmitry',
			account: accountDoc._id
		});
		expect(accountDoc).toMatchObject({
			_id: userDoc.account,
			owner: userDoc._id
		});
	});

	test('one to many', async () => {
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

			@Field(() => Pet)
			pets: Promise<Array<Pet> | null>;
		}

		let pet = new Pet({
			name: 'Tatoshka'
		});

		let owner = new Owner({
			name: 'Dmitry',
			pets: [pet]
		});

		await owner.save();

		let petDoc = await owner.m.db.collection('Pet').findOne({});
		let ownerDoc = await owner.m.db.collection('Owner').findOne({});

		expect(petDoc).toMatchObject({
			_id: ownerDoc.pets[0],
			name: 'Tatoshka'
		});
		expect(ownerDoc).toMatchObject({
			name: 'Dmitry',
			pets: [petDoc._id]
		});
	});

	test('two-way one to many', async () => {
		@Model({
			collectionName: 'Pet'
		})
		class Pet extends BaseModel {
			@Field() name: string | null;

			@Field(() => Owner)
			owner: Promise<Owner | null>;
		}

		@Model({
			collectionName: 'Owner'
		})
		class Owner extends BaseModel {
			@Field() name: string | null;

			@Field(() => Pet)
			pets: Promise<Array<Pet> | null>;
		}

		let pet = new Pet({
			name: 'Tatoshka'
		});

		let owner = new Owner({
			name: 'Dmitry',
			pets: [pet]
		});

		pet.owner = owner as any;

		await owner.save();

		let petDoc = await owner.m.db.collection('Pet').findOne({});
		let ownerDoc = await owner.m.db.collection('Owner').findOne({});

		expect(petDoc).toMatchObject({
			_id: ownerDoc.pets[0],
			name: 'Tatoshka',
			owner: ownerDoc._id
		});
		expect(ownerDoc).toMatchObject({
			name: 'Dmitry',
			pets: [petDoc._id]
		});
	});

	test('many to many', async () => {
		@Model({
			collectionName: 'User'
		})
		class User extends BaseModel {
			@Field() name: string | null;

			@Field(() => Group)
			groups: Promise<Array<Group> | null>;
		}

		@Model({
			collectionName: 'Group'
		})
		class Group extends BaseModel {
			@Field() name: string | null;

			@Field(() => User)
			users: Promise<Array<User> | null>;
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

		let user1Doc = await group1.m.db.collection('User').findOne({ name: 'Dmitry' });
		let user2Doc = await group1.m.db.collection('User').findOne({ name: 'Tatoshka' });
		let group1Doc = await group1.m.db.collection('Group').findOne({ name: 'Admins' });
		let group2Doc = await group1.m.db.collection('Group').findOne({ name: 'Moderators' });

		expect(user1Doc).toMatchObject({
			_id: group1Doc.users[0],
			name: 'Dmitry',
			groups: [group1Doc._id, group2Doc._id]
		});
		expect(user2Doc).toMatchObject({
			_id: group2Doc.users[1],
			name: 'Tatoshka',
			groups: [group2Doc._id]
		});
		expect(group1Doc).toMatchObject({
			_id: user1Doc.groups[0],
			name: 'Admins',
			users: [user1Doc._id]
		});
		expect(group2Doc).toMatchObject({
			_id: user2Doc.groups[0],
			name: 'Moderators',
			users: [user1Doc._id, user2Doc._id]
		});
	});
});

describe('fetch', () => {
	test('simple find', async () => {
		@Model({
			collectionName: 'Pet'
		})
		class Pet extends BaseModel {
			@Field() name: string | null;

			@Field(() => Owner)
			owner: Promise<Owner | null>;
		}

		@Model({
			collectionName: 'Owner'
		})
		class Owner extends BaseModel {
			@Field() name: string | null;

			@Field(() => Pet)
			pets: Promise<Array<Pet> | null>;
		}

		let pet = new Pet({
			name: 'Tatoshka'
		});

		let owner = new Owner({
			name: 'Dmitry',
			pets: [pet]
		});

		pet.owner = owner as any;

		await owner.save();

		let foundCopy = (await Pet.findOne<Pet>({}))!;

		await foundCopy.owner;

		expect(foundCopy.toObject()).toMatchObject({
			_id: pet._id,
			name: 'Tatoshka',
			owner: {
				_id: owner._id,
				name: 'Dmitry',
				pets: [pet._id]
			}
		});
	});

	test('fetch field', async () => {
		@Model({
			collectionName: 'User'
		})
		class User extends BaseModel {
			@Field() name: string | null;

			@Field(() => Account)
			account: Promise<Account | null>;
		}

		@Model({
			collectionName: 'Account'
		})
		class Account extends BaseModel {
			@Field(() => User)
			owner: Promise<User | null>;
		}

		let user = new User({
			name: 'Dmitry'
		});

		let account = new Account({
			owner: user
		});

		user.account = account as any;

		await user.save();

		let user2 = (await User.findOne<User>({}))!;
		let account2 = (await user2.account)!;

		expect((await account2.owner)!._id!.toHexString()).toBe(user2._id!.toHexString());
	});
});

describe('remove', () => {
	test('simple removing', async () => {
		@Model({
			collectionName: 'User'
		})
		class User extends BaseModel {
			@Field() name: string | null;
		}

		let user = new User({
			name: 'Dmitry'
		});

		await user.save();

		expect(await User.exists({ name: 'Dmitry' })).toBeTruthy();

		await user.remove();

		expect(await User.exists({ name: 'Dmitry' })).toBeFalsy();
	});

	test('hooks', async () => {
		let beforeRemove = jest.fn();
		let afterRemove = jest.fn();

		@Model({
			collectionName: 'User'
		})
		class User extends BaseModel {
			@Field() name: string | null;

			beforeRemove = beforeRemove;
			afterRemove = afterRemove;
		}

		let user = new User({
			name: 'Dmitry'
		});

		await user.save();
		await user.remove();

		expect(beforeRemove).toHaveBeenCalledTimes(1);
		expect(afterRemove).toHaveBeenCalledTimes(1);
	});
});

describe('validation', () => {
	test('simple validation', async () => {
		@Model({
			collectionName: 'User'
		})
		class User extends BaseModel {
			@Field({
				validate: value => typeof value == 'string' && value.length >= 2
			})
			name: string | null;

			@Field({
				validate: value => typeof value == 'number' && value >= 0
			})
			age: number | null;
		}

		expect(() => {
			new User();
		}).toThrow();

		let user = new User({
			name: 'Dmitry',
			age: 32
		});

		expect(() => {
			user.name = '1';
		}).toThrow();

		expect(() => {
			user.age = '' as any;
		}).toThrow();
	});

	test('joi', async () => {
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

		expect(() => {
			new User();
		}).toThrow();

		let user = new User({
			name: 'Dmitry',
			age: 32
		});

		expect(() => {
			user.name = '1';
		}).toThrow();

		expect(() => {
			user.age = '' as any;
		}).toThrow();
	});
});
