import * as SQLite from 'expo-sqlite';
const db = SQLite.openDatabase('lnreader.db');

import * as DocumentPicker from 'expo-document-picker';
import * as RNFS from 'react-native-fs';

import { fetchImage, fetchNovel } from '@services/plugin/fetch';
import { insertChapters } from './ChapterQueries';

import { showToast } from '@utils/showToast';
import { txnErrorCallback } from '../utils/helpers';
import { noop } from 'lodash-es';
import { getString } from '@strings/translations';
import { BackupNovel, NovelInfo } from '../types';
import { SourceNovel } from '@plugins/types';
import { NovelDownloadFolder } from '@utils/constants/download';

export const insertNovelAndChapters = async (
  pluginId: string,
  sourceNovel: SourceNovel,
): Promise<number | undefined> => {
  const insertNovelQuery =
    'INSERT INTO Novel (path, pluginId, name, cover, summary, author, artist, status, genres, totalPages) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  const novelId: number | undefined = await new Promise(resolve => {
    db.transaction(tx => {
      tx.executeSql(
        insertNovelQuery,
        [
          sourceNovel.path,
          pluginId,
          sourceNovel.name,
          sourceNovel.cover || null,
          sourceNovel.summary || null,
          sourceNovel.author || null,
          sourceNovel.artist || null,
          sourceNovel.status || null,
          sourceNovel.genres || null,
          sourceNovel.totalPages || 0,
        ],
        async (txObj, resultSet) => resolve(resultSet.insertId),
        txnErrorCallback,
      );
    });
  });
  if (novelId) {
    const promises = [insertChapters(novelId, sourceNovel.chapters)];
    if (sourceNovel.cover) {
      const novelDir = NovelDownloadFolder + '/' + pluginId + '/' + novelId;
      const novelCoverUri = 'file://' + novelDir + '/cover.png';
      promises.push(
        fetchImage(pluginId, sourceNovel.cover).then(base64 => {
          if (base64) {
            RNFS.mkdir(novelDir)
              .then(() => RNFS.writeFile(novelCoverUri, base64, 'base64'))
              .then(() => {
                db.transaction(tx => {
                  tx.executeSql('UPDATE Novel SET cover = ? WHERE id = ?', [
                    novelCoverUri,
                    novelId,
                  ]);
                });
              });
          }
        }),
      );
    }
    await Promise.all(promises);
  }
  return novelId;
};

export const getAllNovels = async (): Promise<NovelInfo[]> => {
  return new Promise(resolve =>
    db.transaction(tx => {
      tx.executeSql('SELECT * FROM Novel', [], (txObj, { rows }) =>
        resolve(rows._array),
      );
    }),
  );
};

export const getNovel = async (
  novelPath: string,
  pluginId: string,
): Promise<NovelInfo | null> => {
  return new Promise(resolve =>
    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM Novel WHERE path = ? AND pluginId = ?',
        [novelPath, pluginId],
        (txObj, { rows }) => resolve(rows.item(0)),
        txnErrorCallback,
      );
    }),
  );
};

// if query is insert novel || add to library => add default category name for it
// else remove all it's categories

export const switchNovelToLibrary = async (
  novelPath: string,
  pluginId: string,
) => {
  const novel = await getNovel(novelPath, pluginId);
  if (novel) {
    db.transaction(tx => {
      tx.executeSql(
        'UPDATE Novel SET inLibrary = ? WHERE id = ?',
        [Number(!novel.inLibrary), novel.id],
        noop,
        txnErrorCallback,
      );
      if (novel.inLibrary) {
        tx.executeSql(
          'DELETE FROM NovelCategory WHERE novelId = ?',
          [novel.id],
          () => showToast(getString('browseScreen.removeFromLibrary')),
          txnErrorCallback,
        );
      } else {
        tx.executeSql(
          'INSERT INTO NovelCategory (novelId, categoryId) VALUES (?, (SELECT DISTINCT id FROM Category WHERE sort = 1))',
          [novel.id],
          () => showToast(getString('browseScreen.addedToLibrary')),
          txnErrorCallback,
        );
        if (novel.pluginId === 'local') {
          tx.executeSql(
            'INSERT INTO NovelCategory (novelId, categoryId) VALUES (?, 2)',
            [novel.id],
          );
        }
      }
    });
  } else {
    const sourceNovel = await fetchNovel(pluginId, novelPath);
    const novelId = await insertNovelAndChapters(pluginId, sourceNovel);
    if (novelId) {
      db.transaction(tx => {
        tx.executeSql(
          'UPDATE Novel SET inLibrary = 1 WHERE id = ?',
          [novelId],
          () => showToast(getString('browseScreen.addedToLibrary')),
          txnErrorCallback,
        );
        tx.executeSql(
          'INSERT INTO NovelCategory (novelId, categoryId) VALUES (?, (SELECT DISTINCT id FROM Category WHERE sort = 1))',
          [novelId],
          noop,
          txnErrorCallback,
        );
      });
    }
  }
};

// allow to delete local novels
export const removeNovelsFromLibrary = (novelIds: Array<number>) => {
  db.transaction(tx => {
    tx.executeSql(
      `UPDATE Novel SET inLibrary = 0 WHERE id IN (${novelIds.join(', ')});`,
    );
    tx.executeSql(
      `DELETE FROM NovelCategory WHERE novelId IN (${novelIds.join(', ')});`,
    );
  });
  showToast(getString('browseScreen.removeFromLibrary'));
};

export const getCachedNovels = (): Promise<NovelInfo[]> => {
  return new Promise(resolve => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM Novel WHERE inLibrary = 0',
        [],
        (txObj, { rows }) => resolve(rows._array as NovelInfo[]),
        txnErrorCallback,
      );
    });
  });
};
export const deleteCachedNovels = async () => {
  db.transaction(tx => {
    tx.executeSql(
      'DELETE FROM Novel WHERE inLibrary = 0',
      [],
      () =>
        showToast(getString('advancedSettingsScreen.cachedNovelsDeletedToast')),
      txnErrorCallback,
    );
  });
};

const restoreFromBackupQuery =
  'INSERT OR REPLACE INTO Novel (path, name, pluginId, cover, summary, author, artist, status, genres, totalPages) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

export const restoreLibrary = async (novel: NovelInfo) => {
  const sourceNovel = await fetchNovel(novel.pluginId, novel.path).catch(e => {
    throw e;
  });
  const novelId: number | undefined = await new Promise(resolve => {
    db.transaction(tx =>
      tx.executeSql(
        restoreFromBackupQuery,
        [
          sourceNovel.path,
          novel.name,
          novel.pluginId,
          novel.cover || '',
          novel.summary || '',
          novel.author || '',
          novel.artist || '',
          novel.status || '',
          novel.genres || '',
          sourceNovel.totalPages || 0,
        ],
        async (txObj, { insertId }) => resolve(insertId),
      ),
    );
  });
  if (novelId && novelId > 0) {
    await new Promise((resolve, reject) => {
      db.transaction(async tx => {
        tx.executeSql(
          'INSERT OR REPLACE INTO NovelCategory (novelId, categoryId) VALUES (?, (SELECT DISTINCT id FROM Category WHERE sort = 1))',
          [novelId],
          () => {
            tx.executeSql('UPDATE Novel SET inLibrary = 1 WHERE id = ?', [
              novelId,
            ]);
            resolve(null);
          },
          (txObj, err) => {
            reject(err);
            return false;
          },
        );
      });
    }).catch(e => {
      throw e;
    });
    if (sourceNovel.chapters) {
      await insertChapters(novelId, sourceNovel.chapters);
    }
  }
};

export const updateNovelInfo = async (info: NovelInfo) => {
  db.transaction(tx => {
    tx.executeSql(
      'UPDATE Novel SET name = ?, cover = ?, path = ?, summary = ?, author = ?, artist = ?, genres = ?, status = ?, isLocal = ? WHERE id = ?',
      [
        info.name,
        info.cover || '',
        info.path,
        info.summary || '',
        info.author || '',
        info.artist || '',
        info.genres || '',
        info.status || '',
        Number(info.isLocal),
        info.id,
      ],
      noop,
      txnErrorCallback,
    );
  });
};

export const pickCustomNovelCover = async (novel: NovelInfo) => {
  const image = await DocumentPicker.getDocumentAsync({ type: 'image/*' });
  if (image.type === 'success' && image.uri) {
    const novelDir =
      NovelDownloadFolder + '/' + novel.pluginId + '/' + novel.id;
    let novelCoverUri = 'file://' + novelDir + '/cover.png';
    RNFS.copyFile(image.uri, novelCoverUri);
    novelCoverUri += '?' + Date.now();
    db.transaction(tx => {
      tx.executeSql(
        'UPDATE Novel SET cover = ? WHERE id = ?',
        [novelCoverUri, novel.id],
        noop,
        txnErrorCallback,
      );
    });
    return novelCoverUri;
  }
};

export const updateNovelCategoryById = async (
  novelId: number,
  categoryIds: number[],
) => {
  db.transaction(tx => {
    categoryIds.forEach(categoryId => {
      tx.executeSql(
        'INSERT INTO NovelCategory (novelId, categoryId) VALUES (?, ?)',
        [novelId, categoryId],
        noop,
        txnErrorCallback,
      );
    });
  });
};

export const updateNovelCategories = async (
  novelIds: number[],
  categoryIds: number[],
): Promise<void> => {
  let queries: string[] = [];
  // not allow others have local id;
  categoryIds = categoryIds.filter(id => id !== 2);
  queries.push(
    `DELETE FROM NovelCategory WHERE novelId IN (${novelIds.join(
      ',',
    )}) AND categoryId != 2`,
  );
  novelIds.forEach(novelId => {
    categoryIds.forEach(categoryId =>
      queries.push(
        `INSERT INTO NovelCategory (novelId, categoryId) VALUES (${novelId}, ${categoryId})`,
      ),
    );
  });
  db.transaction(tx => {
    queries.forEach(query => {
      tx.executeSql(query);
    });
  });
};

const restoreObjectQuery = (table: string, obj: any) => {
  return `
  INSERT INTO ${table}
  (${Object.keys(obj).join(',')})
  VALUES (${Object.keys(obj)
    .map(() => '?')
    .join(',')})
  `;
};

export const _restoreNovelAndChapters = async (backupNovel: BackupNovel) => {
  const { chapters, ...novel } = backupNovel;
  await new Promise(resolve => {
    db.transaction(tx => {
      tx.executeSql('DELETE FROM Novel WHERE id = ?', [novel.id]);
      tx.executeSql(
        restoreObjectQuery('Novel', novel),
        Object.values(novel) as string[] | number[],
        () => resolve(null),
      );
    });
  });
  db.transaction(tx => {
    for (const chapter of chapters) {
      tx.executeSql(
        restoreObjectQuery('Chapter', chapter),
        Object.values(chapter) as string[] | number[],
      );
    }
  });
};
