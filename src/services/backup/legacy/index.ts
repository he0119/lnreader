import * as DocumentPicker from 'expo-document-picker';
import { StorageAccessFramework } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import BackgroundService from 'react-native-background-actions';
import RNFS from 'react-native-fs';

import { getPlugin } from '@plugins/pluginManager';
import { restoreLibrary } from '@database/queries/NovelQueries';
import { getLibraryNovelsFromDb } from '@database/queries/LibraryQueries';
import { showToast } from '@utils/showToast';
import dayjs from 'dayjs';
import { NovelInfo } from '@database/types';
import { sleep } from '@utils/sleep';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { BACKGROUND_ACTION, BackgoundAction } from '@services/constants';
import { getString } from '@strings/translations';

export const createBackup = async () => {
  try {
    MMKVStorage.set(BACKGROUND_ACTION, BackgoundAction.BACKUP);
    const novels = await getLibraryNovelsFromDb();

    const permissions =
      await StorageAccessFramework.requestDirectoryPermissionsAsync();

    if (!permissions.granted) {
      return;
    }

    const uri = permissions.directoryUri;

    const datetime = dayjs().format('YYYY-MM-DD_HH:mm');

    const fileName = 'lnreader_backup_' + datetime;

    if (uri) {
      const fileUri = await StorageAccessFramework.createFileAsync(
        uri,
        fileName,
        'application/json',
      );

      await StorageAccessFramework.writeAsStringAsync(
        fileUri,
        JSON.stringify(novels),
      );

      showToast(getString('backupScreen.legacy.backupCreated', { fileName }));
    }
  } catch (error: any) {
    showToast(error.message);
  } finally {
    MMKVStorage.delete(BACKGROUND_ACTION);
    BackgroundService.stop();
  }
};

interface TaskData {
  delay: number;
}

export const restoreBackup = async (filePath?: string) => {
  try {
    MMKVStorage.set(BACKGROUND_ACTION, BackgoundAction.RESTORE);
    const backup = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: false,
    });
    let novelsString = '';

    if (backup.type === 'success') {
      novelsString = await RNFS.readFile(backup.uri);
    } else if (filePath) {
      if (!(await RNFS.exists(filePath))) {
        showToast(getString('backupScreen.legacy.noErrorNovel'));
        return; //neither backup nor error backup
      }
      novelsString = await RNFS.readFile(filePath);
    }

    const novels: NovelInfo[] = await JSON.parse(novelsString);
    if (novels.length === 0) {
      showToast(getString('backupScreen.legacy.noAvailableBackup'));
      return;
    }
    const notificationOptions = {
      taskName: 'Backup Restore',
      taskTitle: getString('backupScreen.restorinBackup'),
      taskDesc: '(0/' + novels.length + ')',
      taskIcon: { name: 'notification_icon', type: 'drawable' },
      color: '#00adb5',
      parameters: { delay: 1000 },
      linkingURI: 'lnreader://updates',
      progressBar: { max: novels.length, value: 0 },
    };

    const restoreBackupBackgroundAction = async (taskData?: TaskData) =>
      await new Promise<void>(async resolve => {
        const errorNovels = [];
        for (
          let i = 0;
          BackgroundService.isRunning() && i < novels.length;
          i++
        ) {
          try {
            if (BackgroundService.isRunning()) {
              const plugin = getPlugin(novels[i].pluginId);
              if (!plugin) {
                errorNovels.push(novels[i]);
                continue;
              }
              await BackgroundService.updateNotification({
                taskTitle: novels[i].name,
                taskDesc: '(' + (i + 1) + '/' + novels.length + ')',
                progressBar: { max: novels.length, value: i + 1 },
              });
              await restoreLibrary(novels[i]).catch(error => {
                throw error;
              });

              if (novels.length === i + 1) {
                Notifications.scheduleNotificationAsync({
                  content: {
                    title: getString('backupScreen.legacy.libraryRestored'),
                    body: getString('backupScreen.legacy.novelsRestored', {
                      num: novels.length,
                    }),
                  },
                  trigger: null,
                });
                resolve();
              }

              const nextNovelIndex = i + 1;

              if (
                nextNovelIndex in novels &&
                novels[nextNovelIndex].pluginId === novels[i].pluginId
              ) {
                await sleep(taskData?.delay || 0);
              }
            }
          } catch (e) {
            errorNovels.push(novels[i]);
            continue;
          }
        }
        const errorPath = RNFS.ExternalDirectoryPath + '/errorNovels.json';
        if (errorNovels.length > 0) {
          await RNFS.writeFile(errorPath, JSON.stringify(errorNovels));
          Notifications.scheduleNotificationAsync({
            content: {
              title: getString('backupScreen.legacy.libraryRestored'),
              body: getString('backupScreen.legacy.novelsRestoredError', {
                num: errorNovels.length,
              }),
            },
            trigger: null,
          });
          resolve();
        } else {
          RNFS.exists(errorPath).then(exist => {
            if (exist) {
              RNFS.unlink(errorPath);
            }
          });
        }
      }).finally(() => {
        MMKVStorage.delete(BACKGROUND_ACTION);
        BackgroundService.stop();
      });

    if (novels.length > 0) {
      await BackgroundService.start<TaskData>(
        restoreBackupBackgroundAction,
        notificationOptions,
      );
    }
  } catch (error: any) {
    showToast(error.message);
  }
};

export const restoreError = async () => {
  const errorPath = RNFS.ExternalDirectoryPath + '/errorNovels.json';
  restoreBackup(errorPath);
};
