import * as winston from 'winston';
import * as util from 'util';
import * as AWS from 'aws-sdk';
import * as uuid from 'node-uuid';
import * as _ from 'lodash';
import * as os from 'os';

const hostname = os.hostname();

function datify(timestamp) {
  let dateTS = new Date(timestamp);
  let date = {
    year: dateTS.getFullYear(),
    month: dateTS.getMonth() + 1,
    day: dateTS.getDate(),
    hour: dateTS.getHours(),
    minute: dateTS.getMinutes(),
    second: dateTS.getSeconds(),
    millisecond: dateTS.getMilliseconds()
  };

  let keys = _.without(Object.keys(date), "year", "month", "day");
  let len = keys.length;
  for (let i = 0; i < len; i++) {
    let key = keys[i];
    if (date[key] < 10) {
      date[key] = "0" + date[key];
    }
  }
  return `${date.year}-${date.month}-${date.day} ${date.hour}:${date.minute}:${date.second}.${date.millisecond}`;
}

export class DynamoDB {
  regions: string[];
  name: string;
  level: string;
  db; // Type?
  AWS;  // Type?
  region: string;
  tableName: string;
  dynamoDoc;  // Type?
  
  constructor(options) {
    if (options == null) {
      options = {};
    }
    this.regions = ["us-east-1", "us-west-1", "us-west-2", "eu-west-1", "eu-central-1", "ap-northeast-1", "ap-northeast-2", "ap-southeast-1", "ap-southeast-2", "sa-east-1"];
    if (options.useEnvironment) {
      options.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
      options.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
      options.region = process.env.AWS_REGION;
    }
    if (options.accessKeyId == null) {
      throw new Error("need accessKeyId");
    }
    if (options.secretAccessKey == null) {
      throw new Error("need secretAccessKey");
    }
    if (options.region == null) {
      throw new Error("need region");
    }
    if (this.regions.indexOf(options.region) < 0) {
      throw new Error("unavailable region given");
    }
    if (options.tableName == null) {
      throw new Error("need tableName");
    }
    if (!options.useEnvironment) {
      AWS.config.update({
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
        region: options.region
      });
    }
    this.name = "dynamodb";
    this.level = options.level || "info";
    this.db = new AWS.DynamoDB();
    this.AWS = AWS;
    this.region = options.region;
    this.tableName = options.tableName;
    this.dynamoDoc = options.dynamoDoc;
    return this.dynamoDoc;
  }

  log(level, msg, meta, callback) {
    let dynamoDocClient, params;
    let putCallback = (_this) => {
      return (err, data) => {
        if (err) {
          _this.emit("error", err);
          if (callback) {
            return callback(err, null);
          }
        } else {
          _this.emit("logged");
          if (callback) {
            return callback(null, "logged");
          }
        }
      };
    };
    putCallback(this);
    if (this.dynamoDoc === true) {
      params = {
        TableName: this.tableName,
        Item: {
          id: uuid.v4(),
          level: level,
          timestamp: datify(Date.now()),
          msg: msg,
          hostname: hostname
        }
      };
      if (!_.isEmpty(meta)) {
        params.Item.meta = meta;
      }
      dynamoDocClient = new this.AWS.DynamoDB.DocumentClient({
        service: this.db
      });
      return dynamoDocClient.put(params, putCallback);
    } else {
      params = {
        TableName: this.tableName,
        Item: {
          id: {
            "S": uuid.v4()
          },
          level: {
            "S": level
          },
          timestamp: {
            "S": datify(Date.now())
          },
          msg: {
            "S": msg
          },
          hostname: {
            "S": hostname
          }
        }
      };
      if (!_.isEmpty(meta)) {
        params.Item.meta = {
          "S": JSON.stringify(meta)
        };
      }
      return this.db.putItem(params, putCallback);
    }
  }

}

util.inherits(DynamoDB, winston.Transport);

winston.transports['DynamoDB'] = DynamoDB;