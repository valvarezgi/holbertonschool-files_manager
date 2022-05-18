import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AuthController {
  static async getConnect(request, response) {
    const authHeader = request.header('authorization').split(' ')[1];
    const buff = Buffer.from(authHeader, 'base64');
    const [email, password] = buff.toString('ascii').split(':');
    if (!email || !password) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    /* const sha1Hash = crypto.createHash('sha1');
    sha1Hash.update(password);
    const hashPass = sha1Hash.digest('hex'); */
    const hashPass = sha1(password);
    const users = dbClient.database.collection('users');
    const user = await users.findOne({ email, password: hashPass });
    if (!user) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const token = uuidv4();
    const key = `auth_${token}`;
    await redisClient.set(key, user._id, 24 * 60 * 60);
    response.status(200).json({ token });
  }

  static async getDisconnect(request, response) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await redisClient.del(key);
    response.status(204).json({});
  }
}

export default AuthController;
