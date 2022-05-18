import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const url = `mongodb://${host}:${port}`;
    this.client = new MongoClient(url);
    this._is_alive = false;
  }

  async init() {
    try {
      await this.client.connect();
      this._is_alive = true;
      const database = process.env.DB_DATABASE || 'files_manager';
      this.database = this.client.db(database);
    } catch (err) {
      console.error(err);
    }
  }

  isAlive() { return this._is_alive; }

  async nbUsers() {
    const userCount = await this.database.collection('users').countDocuments();
    return userCount;
  }

  async nbFiles() {
    const fileCount = await this.database.collection('files').countDocuments();
    return fileCount;
  }
}

const dbClient = new DBClient();
dbClient.init();

export default dbClient;
