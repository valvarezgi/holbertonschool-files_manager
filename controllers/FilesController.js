import mime from 'mime-types';
import { ObjectID } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

class FilesController {
  static async postUpload(request, response) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, type, data } = request.body;
    let { parentId, isPublic } = request.body;
    isPublic = !!isPublic;
    parentId = parentId || '0';
    const files = dbClient.database.collection('files');
    if (!name) {
      response.status(400).json({ error: 'Missing name' });
    } else if (!['file', 'image', 'folder'].includes(type)) {
      response.status(400).json({ error: 'Missing type' });
    } else if (!data && type !== 'folder') {
      response.status(400).json({ error: 'Missing data' });
    } else {
      if (parentId !== '0') {
        const parentFile = await files.findOne({ _id: ObjectID(parentId) });
        if (!parentFile) {
          response.status(400).json({ error: 'Parent not found' });
        } else if (parentFile.type !== 'folder') {
          response.status(400).json({ error: 'Parent is not a folder' });
          return;
        }
      }

      if (!fs.existsSync(FOLDER_PATH)) fs.mkdirSync(FOLDER_PATH);
      if (type === 'folder') {
        const { insertedId } = await files.insertOne({
          name, type, parentId, isPublic, userId: ObjectID(userId),
        });
        response.status(201).json({
          name, type, parentId, isPublic, userId, id: insertedId,
        });
      } else {
        const token = uuidv4();
        const buff = Buffer.from(data, 'base64');
        const localPath = `${FOLDER_PATH}/${token}`;
        fs.writeFileSync(localPath, buff, { encoding: 'binary' });
        const { insertedId } = await files.insertOne({
          name, type, parentId, isPublic, userId: ObjectID(userId), localPath,
        });
        response.status(201).json({
          name, type, parentId, isPublic, userId, id: insertedId,
        });
      }
    }
  }

  static async getShow(request, response) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const files = dbClient.database.collection('files');
    const fileInfo = await files.findOne({
      userId: ObjectID(userId),
      _id: ObjectID(request.params.id),
    });

    if (!fileInfo) {
      response.status(404).json({ error: 'Not found' });
      return;
    }
    const {
      name, type, parentId, isPublic, _id,
    } = fileInfo;
    response.status(200).json({
      name, type, parentId, isPublic, userId, id: _id,
    });
  }

  static async getIndex(request, response) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let { parentId } = request.query;
    parentId = parentId ? ObjectID(parentId) : '0';
    let { page } = request.query;
    page = page ? parseInt(page, 10) : 0;
    const files = dbClient.database.collection('files');
    const PAGE_SIZE = 20;
    const resultsArray = await files.aggregate([
      { $match: { parentId, userId: ObjectID(userId) } },
      { $skip: page * PAGE_SIZE },
      { $limit: PAGE_SIZE },
    ]).toArray();
    const responseArray = resultsArray.map((res) => ({
      id: res._id.toString(),
      userId: res.userId,
      name: res.name,
      type: res.type,
      isPublic: res.isPublic,
      parentId: res.parentId,
    }));
    response.status(200).json(responseArray);
  }

  static async setPublic(request, response, isPublic) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const fileId = request.params.id === '0' ? '0' : ObjectID(request.params.id);
    const files = dbClient.database.collection('files');
    const fileInfo = await files.findOne({
      userId: ObjectID(userId),
      _id: fileId,
    });

    if (!fileInfo) {
      response.status(404).json({ error: 'Not found' });
    } else {
      await files.updateOne({
        _id: fileId,
        userId: ObjectID(userId),
      }, { $set: { isPublic } });
      const {
        name, type, parentId, _id,
      } = fileInfo;
      response.status(200).json({
        name, type, parentId, isPublic, userId, id: _id,
      });
    }
  }

  static async putPublish(request, response) {
    return FilesController.setPublic(request, response, true);
  }

  static async putUnpublish(request, response) {
    return FilesController.setPublic(request, response, false);
  }

  static async getFile(request, response) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    const activeUserId = await redisClient.get(key);

    const fileId = request.params.id === '0' ? '0' : ObjectID(request.params.id);
    const files = dbClient.database.collection('files');
    const fileInfo = await files.findOne({
      _id: fileId,
    });

    if (!fileInfo) {
      response.status(404).json({ error: 'Not found' });
      return;
    }

    const {
      name, type, isPublic, userId, localPath,
    } = fileInfo;

    if (!isPublic && (!activeUserId || userId.toString() !== activeUserId)) {
      response.status(404).json({ error: 'Not found' });
    } else if (type === 'folder') {
      response.status(400).json({ error: "A folder doesn't have content" });
    } else if (!fs.existsSync(localPath)) {
      response.status(404).json({ error: 'Not found' });
    } else {
      const mimeType = mime.lookup(name);
      const data = fs.readFileSync(localPath);
      response.status(200).setHeader('Content-Type', mimeType).send(data);
    }
  }
}

export default FilesController;
