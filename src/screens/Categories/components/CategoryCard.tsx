import { StyleSheet, Text, View } from 'react-native';
import React from 'react';

import { Category } from '@database/types';
import { useTheme } from '@hooks/persisted';
import AddCategoryModal from './AddCategoryModal';
import { useBoolean } from '@hooks';
import { overlay, Portal } from 'react-native-paper';
import IconButton from '@components/IconButtonV2/IconButtonV2';
import DeleteCategoryModal from './DeleteCategoryModal';

interface CategoryCardProps {
  categoryIndex: number;
  category: Category;
  getCategories: () => Promise<void>;
  updateCategorySort: (currentIndex: number, newIndex: number) => void;
  totalCategories: number;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  getCategories,
  categoryIndex,
  updateCategorySort,
  totalCategories,
}) => {
  const theme = useTheme();

  const {
    value: categoryModalVisible,
    setTrue: showCategoryModal,
    setFalse: closeCategoryModal,
  } = useBoolean();

  const {
    value: deletecategoryModalVisible,
    setTrue: showDeleteCategoryModal,
    setFalse: closeDeleteCategoryModal,
  } = useBoolean();

  return (
    <>
      <View
        style={[
          styles.cardCtn,
          {
            backgroundColor:
              category.sort === 1
                ? theme.isDark
                  ? overlay(2, theme.surface2)
                  : theme.primaryContainer
                : category.id === 2
                ? theme.tertiaryContainer
                : theme.secondaryContainer,
          },
        ]}
      >
        <View style={styles.nameCtn}>
          <IconButton
            name="label-outline"
            color={theme.onSurface}
            padding={0}
            theme={theme}
          />
          <Text
            style={[
              styles.name,
              {
                color: theme.onSurface,
                fontWeight: category.sort === 1 ? '700' : '300',
              },
            ]}
            onPress={showCategoryModal}
          >
            {category.name}
          </Text>
        </View>
        <View style={styles.buttonsCtn}>
          <IconButton
            name="menu-up"
            color={theme.onSurface}
            onPress={() => updateCategorySort(categoryIndex, categoryIndex - 1)}
            theme={theme}
            disabled={
              categoryIndex <= 0 || (categoryIndex === 1 && category.id === 2)
            }
          />
          <IconButton
            name="menu-down"
            color={theme.onSurface}
            style={styles.orderDownBtn}
            onPress={() => updateCategorySort(categoryIndex, categoryIndex + 1)}
            theme={theme}
            disabled={categoryIndex + 1 >= totalCategories}
          />
          <View style={styles.flex} />
          <IconButton
            name="pencil-outline"
            color={theme.onSurface}
            style={styles.manageBtn}
            onPress={showCategoryModal}
            theme={theme}
          />
          {categoryIndex !== 0 && category.id !== 2 && (
            <IconButton
              name="delete-outline"
              color={theme.onSurface}
              style={styles.manageBtn}
              onPress={showDeleteCategoryModal}
              theme={theme}
            />
          )}
        </View>
      </View>
      <Portal>
        <AddCategoryModal
          isEditMode
          category={category}
          visible={categoryModalVisible}
          closeModal={closeCategoryModal}
          onSuccess={getCategories}
        />
        <DeleteCategoryModal
          category={category}
          visible={deletecategoryModalVisible}
          closeModal={closeDeleteCategoryModal}
          onSuccess={getCategories}
        />
      </Portal>
    </>
  );
};

export default CategoryCard;

const styles = StyleSheet.create({
  cardCtn: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    elevation: 1,
  },
  name: {
    marginHorizontal: 16,
  },
  flex: {
    flex: 1,
  },
  manageBtn: {
    marginLeft: 16,
  },
  orderDownBtn: {
    marginLeft: 8,
  },
  nameCtn: {
    flex: 1,
    marginLeft: 8,
    paddingRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  buttonsCtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
