import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../shared/database.js';

export class FavoriteModel extends Model {
  declare id: string;
  declare userId: string;
  declare questionId: string;
  declare note: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

FavoriteModel.init(
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
    note: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ''
    }
  },
  {
    sequelize,
    modelName: 'Favorite',
    tableName: 'favorites',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['question_id'] },
      { unique: true, fields: ['user_id', 'question_id'] }
    ]
  }
);
