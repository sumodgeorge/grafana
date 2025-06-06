import { CoreApp } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n/internal';
import { config } from '@grafana/runtime';
import { SceneTimeRangeLike, VizPanel } from '@grafana/scenes';
import { DataLinksInlineEditor, Input, TextArea, Switch } from '@grafana/ui';
import { GenAIPanelDescriptionButton } from 'app/features/dashboard/components/GenAI/GenAIPanelDescriptionButton';
import { GenAIPanelTitleButton } from 'app/features/dashboard/components/GenAI/GenAIPanelTitleButton';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { getPanelLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

import { VizPanelLinks } from '../scene/PanelLinks';
import { PanelTimeRange } from '../scene/PanelTimeRange';
import { useEditPaneInputAutoFocus } from '../scene/layouts-shared/utils';
import { isDashboardLayoutItem } from '../scene/types/DashboardLayoutItem';
import { vizPanelToPanel, transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getDashboardSceneFor } from '../utils/utils';

export function getPanelFrameOptions(panel: VizPanel): OptionsPaneCategoryDescriptor {
  const descriptor = new OptionsPaneCategoryDescriptor({
    title: t('dashboard-scene.get-panel-frame-options.descriptor.title.panel-options', 'Panel options'),
    id: 'Panel options',
    isOpenDefault: true,
  });

  const panelLinksObject = dashboardSceneGraph.getPanelLinks(panel);
  const links = panelLinksObject?.state.rawLinks ?? [];
  const dashboard = getDashboardSceneFor(panel);
  const layoutElement = panel.parent!;

  descriptor
    .addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard-scene.get-panel-frame-options.title.title', 'Title'),
        value: panel.state.title,
        popularRank: 1,
        render: function renderTitle() {
          return <PanelFrameTitleInput panel={panel} />;
        },
        addon: config.featureToggles.dashgpt && (
          <GenAIPanelTitleButton
            onGenerate={(title) => setPanelTitle(panel, title)}
            panel={vizPanelToPanel(panel)}
            dashboard={transformSceneToSaveModel(dashboard)}
          />
        ),
      })
    )
    .addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard-scene.get-panel-frame-options.title.description', 'Description'),
        value: panel.state.description,
        render: function renderDescription() {
          return <PanelDescriptionTextArea panel={panel} />;
        },
        addon: config.featureToggles.dashgpt && (
          <GenAIPanelDescriptionButton
            onGenerate={(description) => panel.setState({ description })}
            panel={vizPanelToPanel(panel)}
          />
        ),
      })
    )
    .addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard-scene.get-panel-frame-options.title.transparent-background', 'Transparent background'),
        render: function renderTransparent() {
          return <PanelBackgroundSwitch panel={panel} />;
        },
      })
    )
    .addCategory(
      new OptionsPaneCategoryDescriptor({
        title: t('dashboard-scene.get-panel-frame-options.title.panel-links', 'Panel links'),
        id: 'Panel links',
        isOpenDefault: false,
        itemsCount: links?.length,
      }).addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard-scene.get-panel-frame-options.title.panel-links', 'Panel links'),
          render: () => <ScenePanelLinksEditor panelLinks={panelLinksObject ?? undefined} />,
        })
      )
    );

  if (isDashboardLayoutItem(layoutElement)) {
    layoutElement.getOptions?.().forEach((category) => descriptor.addCategory(category));
  }

  return descriptor;
}

interface ScenePanelLinksEditorProps {
  panelLinks?: VizPanelLinks;
}

function ScenePanelLinksEditor({ panelLinks }: ScenePanelLinksEditorProps) {
  const { rawLinks: links } = panelLinks ? panelLinks.useState() : { rawLinks: [] };

  return (
    <DataLinksInlineEditor
      links={links}
      onChange={(links) => panelLinks?.setState({ rawLinks: links })}
      getSuggestions={getPanelLinksVariableSuggestions}
      data={[]}
    />
  );
}

export function PanelFrameTitleInput({ panel, isNewElement }: { panel: VizPanel; isNewElement?: boolean }) {
  const { title } = panel.useState();
  const notInPanelEdit = panel.getPanelContext().app !== CoreApp.PanelEditor;

  let ref = useEditPaneInputAutoFocus({
    autoFocus: notInPanelEdit && isNewElement,
  });

  return (
    <Input
      ref={ref}
      data-testid={selectors.components.PanelEditor.OptionsPane.fieldInput('Title')}
      value={title}
      onChange={(e) => setPanelTitle(panel, e.currentTarget.value)}
    />
  );
}

export function PanelDescriptionTextArea({ panel }: { panel: VizPanel }) {
  const { description } = panel.useState();

  return (
    <TextArea
      id="description-text-area"
      value={description}
      onChange={(e) => panel.setState({ description: e.currentTarget.value })}
    />
  );
}

export function PanelBackgroundSwitch({ panel }: { panel: VizPanel }) {
  const { displayMode } = panel.useState();

  return (
    <Switch
      value={displayMode === 'transparent'}
      id="transparent-background"
      onChange={() => {
        panel.setState({
          displayMode: panel.state.displayMode === 'transparent' ? 'default' : 'transparent',
        });
      }}
    />
  );
}

export function setPanelTitle(panel: VizPanel, title: string) {
  panel.setState({ title: title, hoverHeader: getUpdatedHoverHeader(title, panel.state.$timeRange) });
}

export function getUpdatedHoverHeader(title: string, timeRange: SceneTimeRangeLike | undefined): boolean {
  if (title !== '') {
    return false;
  }

  if (timeRange instanceof PanelTimeRange && !timeRange.state.hideTimeOverride) {
    if (timeRange.state.timeFrom || timeRange.state.timeShift) {
      return false;
    }
  }

  return true;
}
