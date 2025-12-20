import winston from 'winston';

export class Logger {
  private static instance: winston.Logger;

  static getInstance(): winston.Logger {
    if (!Logger.instance) {
      Logger.instance = winston.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        ),
        transports: [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.printf(({ timestamp, level, message, ...meta }) => {
                let msg = `${timestamp} [${level}]: ${message}`;
                if (Object.keys(meta).length > 0) {
                  msg += ` ${JSON.stringify(meta)}`;
                }
                return msg;
              })
            ),
          }),
          new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
          new winston.transports.File({ filename: 'logs/combined.log' }),
        ],
      });
    }
    return Logger.instance;
  }
}
