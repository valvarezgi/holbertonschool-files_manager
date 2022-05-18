import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AppController {
  static getStatus(request, response) {
    const redisIsAlive = redisClient.isAlive();
    const dbIsAlive = dbClient.isAlive();
    response.status(200).json({ redis: redisIsAlive, db: dbIsAlive });
  }

  static async getStats(request, response) {
    const userCount = await dbClient.nbUsers();
    const fileCount = await dbClient.nbFiles();
    response.status(200).json({ users: userCount, files: fileCount });
  }
}

export default AppController;
