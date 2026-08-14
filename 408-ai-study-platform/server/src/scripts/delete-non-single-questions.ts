import { Op } from 'sequelize';
import { FavoriteModel } from '../models/favorite.model.js';
import { PaperModel } from '../models/paper.model.js';
import { QuestionModel } from '../models/question.model.js';
import { ReviewTaskModel } from '../models/review-task.model.js';
import { StudyRecordModel } from '../models/study-record.model.js';
import { WrongBookModel } from '../models/wrong-book.model.js';
import { sequelize } from '../shared/database.js';

const main = async () => {
  const questions = await QuestionModel.findAll({
    where: { type: { [Op.ne]: 'single' } },
    attributes: ['id', 'type']
  });
  const questionIds = questions.map(item => item.id);
  const byType = questions.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1;
    return acc;
  }, {});

  if (!questionIds.length) {
    console.log(JSON.stringify({ deleted: 0, byType }, null, 2));
    return;
  }

  await sequelize.transaction(async transaction => {
    const where = { questionId: { [Op.in]: questionIds } };
    await Promise.all([
      FavoriteModel.destroy({ where, transaction }),
      WrongBookModel.destroy({ where, transaction }),
      StudyRecordModel.destroy({ where, transaction }),
      ReviewTaskModel.destroy({ where, transaction })
    ]);

    const papers = await PaperModel.findAll({ transaction });
    await Promise.all(papers.map(async paper => {
      const currentIds = Array.isArray(paper.questionIds) ? paper.questionIds : [];
      const nextIds = currentIds.filter(id => !questionIds.includes(String(id)));
      if (nextIds.length !== currentIds.length) {
        await paper.update({ questionIds: nextIds }, { transaction });
      }
    }));

    await QuestionModel.destroy({
      where: { id: { [Op.in]: questionIds } },
      transaction
    });
  });

  console.log(JSON.stringify({ deleted: questionIds.length, byType }, null, 2));
};

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
