import React, { RefObject, memo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  DrawerLayoutAndroid,
} from 'react-native';
import color from 'color';

import * as Clipboard from 'expo-clipboard';

import { IconButton } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { showToast } from '@utils/showToast';

import {
  CoverImage,
  NovelInfo,
  NovelInfoContainer,
  NovelThumbnail,
  NovelTitle,
  NovelGenres,
} from './NovelInfoComponents';
import { Row } from '@components/Common';
import ReadButton from './ReadButton';
import NovelSummary from '../NovelSummary/NovelSummary';
import NovelScreenButtonGroup from '../NovelScreenButtonGroup/NovelScreenButtonGroup';
import { getString } from '@strings/translations';
import { filterColor } from '@theme/colors';
import { ChapterInfo, NovelInfo as NovelData } from '@database/types';
import { ThemeColors } from '@theme/types';
import { NovelScreenProps } from '@navigators/types';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { UseBooleanReturnType } from '@hooks';
import { useAppSettings } from '@hooks/persisted';
import { NovelStatus } from '@plugins/types';
import { translateNovelStatus } from '@utils/translateEnum';

interface NovelInfoHeaderProps {
  novel: NovelData;
  theme: ThemeColors;
  filter: string;
  chapters: ChapterInfo[];
  lastRead?: ChapterInfo;
  navigation: NovelScreenProps['navigation'];
  trackerSheetRef: React.RefObject<BottomSheetModalMethods>;
  navigateToChapter: (chapter: ChapterInfo) => void;
  setCustomNovelCover: () => Promise<void>;
  followNovel: () => void;
  novelBottomSheetRef: React.RefObject<BottomSheetModalMethods>;
  deleteDownloadsSnackbar: UseBooleanReturnType;
  page?: string;
  drawerRef: RefObject<DrawerLayoutAndroid>;
}

const NovelInfoHeader = ({
  novel,
  theme,
  filter,
  chapters,
  lastRead,
  navigation,
  trackerSheetRef,
  navigateToChapter,
  setCustomNovelCover,
  followNovel,
  novelBottomSheetRef,
  deleteDownloadsSnackbar,
  page,
  drawerRef,
}: NovelInfoHeaderProps) => {
  const { hideBackdrop = false } = useAppSettings();

  const getStatusIcon = useCallback((status?: string) => {
    if (status === NovelStatus.Ongoing) {
      return 'clock-outline';
    }
    if (status === NovelStatus.Completed) {
      return 'check-all';
    }
    return 'help';
  }, []);
  return (
    <>
      <CoverImage
        source={{ uri: novel.cover }}
        theme={theme}
        hideBackdrop={hideBackdrop}
      >
        <NovelInfoContainer>
          <NovelThumbnail
            source={{ uri: novel.cover }}
            theme={theme}
            setCustomNovelCover={setCustomNovelCover}
          />
          <View style={styles.novelDetails}>
            <Row>
              <NovelTitle
                theme={theme}
                onPress={() =>
                  navigation.replace('GlobalSearchScreen', {
                    searchText: novel.name,
                  })
                }
                onLongPress={() => {
                  Clipboard.setStringAsync(novel.name).then(() =>
                    showToast(
                      getString('common.copiedToClipboard', {
                        name: novel.name,
                      }),
                    ),
                  );
                }}
              >
                {novel.name}
              </NovelTitle>
            </Row>
            {novel.author && (
              <Row>
                <MaterialCommunityIcons
                  name="fountain-pen-tip"
                  size={14}
                  color={theme.onSurfaceVariant}
                  style={{ marginRight: 4 }}
                />
                <NovelInfo theme={theme}>{novel.author}</NovelInfo>
              </Row>
            )}
            {novel.artist && (
              <Row>
                <MaterialCommunityIcons
                  name="palette-outline"
                  size={14}
                  color={theme.onSurfaceVariant}
                  style={{ marginRight: 4 }}
                />
                <NovelInfo theme={theme}>{novel.artist}</NovelInfo>
              </Row>
            )}
            <Row>
              <MaterialCommunityIcons
                name={getStatusIcon(novel.status)}
                size={14}
                color={theme.onSurfaceVariant}
                style={{ marginRight: 4 }}
              />
              <NovelInfo theme={theme}>
                {(translateNovelStatus(novel.status) ||
                  getString('novelScreen.unknownStatus')) +
                  ' • ' +
                  novel.pluginId}
              </NovelInfo>
            </Row>
          </View>
        </NovelInfoContainer>
      </CoverImage>
      <>
        <NovelScreenButtonGroup
          novel={novel}
          handleFollowNovel={() => {
            followNovel();
            if (
              novel.inLibrary &&
              chapters.some(chapter => chapter.isDownloaded)
            ) {
              deleteDownloadsSnackbar.setTrue();
            }
          }}
          handleTrackerSheet={() => trackerSheetRef.current?.present()}
          theme={theme}
        />
        <NovelSummary
          summary={novel.summary || getString('novelScreen.noSummary')}
          isExpanded={!novel.inLibrary}
          theme={theme}
        />
        {novel.genres ? (
          <NovelGenres theme={theme} genres={novel.genres} />
        ) : null}
        <ReadButton
          navigateToChapter={navigateToChapter}
          chapters={chapters}
          lastRead={lastRead}
        />
        <Pressable
          style={styles.bottomsheet}
          onPress={() =>
            page
              ? drawerRef.current?.openDrawer()
              : novelBottomSheetRef.current?.present()
          }
          android_ripple={{
            color: color(theme.primary).alpha(0.12).string(),
          }}
        >
          <View style={{ flex: 1 }}>
            {page ? (
              <Text
                numberOfLines={2}
                style={[{ color: theme.onSurface }, styles.pageTitle]}
              >
                Page: {page}
              </Text>
            ) : null}
            <Text style={[{ color: theme.onSurface }, styles.chapters]}>
              {`${chapters?.length} ${getString('novelScreen.chapters')}`}
            </Text>
          </View>
          <IconButton
            icon="filter-variant"
            iconColor={filter ? filterColor(theme.isDark) : theme.onSurface}
            size={24}
            onPress={() => novelBottomSheetRef.current?.present()}
          />
        </Pressable>
      </>
    </>
  );
};

export default memo(NovelInfoHeader);

const styles = StyleSheet.create({
  novelDetails: {
    flex: 1,
    flexDirection: 'column',
    paddingBottom: 16,
    paddingLeft: 12,
    justifyContent: 'center',
  },
  pageTitle: {
    paddingHorizontal: 16,
    fontSize: 16,
  },
  chapters: {
    paddingHorizontal: 16,
    fontSize: 14,
  },
  bottomsheet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: 12,
  },
  infoItem: {
    marginVertical: 2,
  },
});
