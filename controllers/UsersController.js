import { ObjectID } from 'mongodb';
import sha1 from 'sha1';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class UsersController {
  static async postNew(request, response) {
    const { email } = request.body;
    if (!email) {
      response.status(400).json({ error: 'Missing email' });
      return;
    }
    const users = dbClient.database.collection('users');
    const dupEmail = await users.findOne({ email });
    if (dupEmail) {
      response.status(400).json({ error: 'Already exist' });
      return;
    }

    const { password } = request.body;
    if (!password) {
      response.status(400).json({ error: 'Missing password' });
      return;
    }
    /* const sha1Hash = crypto.createHash('sha1');
    sha1Hash.update(password);
    const hashPass = sha1Hash.digest('hex'); */
    const hashPass = sha1(password);
    const result = await users.insertOne({ email, password: hashPass });
    response.status(201).json({ id: result.insertedId, email });
  }

  static async getMe(request, response) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const users = dbClient.database.collection('users');
    const user = await users.findOne({ _id: ObjectID(userId) });
    response.status(200).json({ id: user._id, email: user.email });
  }
}

export default UsersController;
