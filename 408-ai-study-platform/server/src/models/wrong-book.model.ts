import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../shared/database.js';

export class WrongBookModel extends Model {
  declare id: string;
  declare userId: string;
  declare questionId: string;
  declare wrongAnswer: any;
  declare wrongCount: number;
  declare reason: string;
  declare mastered: boolean;
  declare lastWrongAt: Date;
  declare createdAt: Date;
  declare updatedAt: Date;
}

WrongBookModel.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    questionId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'questions', key: 'id' }
    },
    wrongAnswer: {
      type: DataTypes.JSON,
      allowNull: true
    },
    wrongCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ''
    },
    mastered: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    lastWrongAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    modelName: 'WrongBook',
    tableName: 'wrong_books',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['question_id'] },
      { unique: true, fields: ['user_id', 'question_id'] }
    ]
  }
);
