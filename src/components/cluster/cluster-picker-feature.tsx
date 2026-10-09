import { ClusterNetwork, useCluster } from "./cluster-data-access";
import { RadioButton, Text } from "react-native-paper";
import { ClusterPickerRadioButtonGroupRow } from "./cluster-ui";

export default function ClusterPickerFeature() {
  const { selectedCluster, clusters, setSelectedCluster } = useCluster();

  return (
    <>
      <Text variant="headlineMedium">Cluster:</Text>
      <RadioButton.Group
        value={selectedCluster.name}
        onValueChange={(name) => {
          const next = clusters.find((cluster) => cluster.name === name);
          if (next) setSelectedCluster(next);
        }}
      >
        {clusters.map((cluster) => (
          <ClusterPickerRadioButtonGroupRow
            key={cluster.name}
            cluster={cluster}
          />
        ))}
      </RadioButton.Group>
      {selectedCluster.network === ClusterNetwork.Mainnet && (
        <Text>Mainnet uses real assets. Check the network before any payment.</Text>
      )}
    </>
  );
}
