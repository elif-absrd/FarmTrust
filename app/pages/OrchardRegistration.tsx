import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { PageWrapper } from '../components/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/utils/api';
import { useRouter } from 'expo-router';

interface FarmResponse {
  farm: {
    id: number;
    farmName: string;
  };
}

interface OrchardSubmitResponse {
  message: string;
  farm: FarmResponse['farm'];
  orchardRegistration?: {
    id: number;
    registrationStatus?: string | null;
    locationValidated?: boolean;
    locationValidationScore?: number | null;
    ndviScore?: number | null;
  };
}

const treeOptions = [
  'Apple',
  'Mango',
  'Orange',
  'Pear',
  'Peach',
  'Plum',
  'Cherry',
  'Banana',
  'Guava',
  'Coconut',
  'Lemon',
  'Papaya',
];

export default function OrchardRegistration() {
  const router = useRouter();
  const { token, refreshUser } = useAuth();

  const [orchardName, setOrchardName] = useState('');
  const [orchardType, setOrchardType] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [village, setVillage] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [pincode, setPincode] = useState('');
  const [landmark, setLandmark] = useState('');
  const [areaAcres, setAreaAcres] = useState('');
  const [numberOfTrees, setNumberOfTrees] = useState('');
  const [gpsPolygon, setGpsPolygon] = useState<any | null>(null);
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [selectedTreeTypes, setSelectedTreeTypes] = useState<string[]>([]);
  const [documents, setDocuments] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [saving, setSaving] = useState(false);
  const [ndviInfo, setNdviInfo] = useState<string | null>(null);

  const treeSummary = useMemo(
    () => (selectedTreeTypes.length ? selectedTreeTypes.join(', ') : 'Select tree types'),
    [selectedTreeTypes],
  );

  const toggleTreeType = (treeType: string) => {
    setSelectedTreeTypes((current) =>
      current.includes(treeType)
        ? current.filter((item) => item !== treeType)
        : [...current, treeType],
    );
  };

  const pickDocuments = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: ['application/pdf', 'image/*'],
      });

      if (result.canceled) {
        return;
      }

      setDocuments((current) => [...current, ...result.assets]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to pick documents';
      Alert.alert('Document upload failed', message);
    }
  };

  const buildPerimeterPolygon = (latitude: number, longitude: number) => {
    const delta = 0.00045;
    return {
      type: 'Polygon',
      coordinates: [[
        [longitude - delta, latitude - delta],
        [longitude + delta, latitude - delta],
        [longitude + delta, latitude + delta],
        [longitude - delta, latitude + delta],
        [longitude - delta, latitude - delta],
      ]],
    };
  };

  const captureOrchardPerimeter = async () => {
    try {
      setCapturingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Location permission is needed to capture orchard perimeter.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const polygon = buildPerimeterPolygon(location.coords.latitude, location.coords.longitude);
      setGpsPolygon(polygon);
      Alert.alert('Perimeter captured', 'Orchard GPS polygon was captured from your location.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to capture location';
      Alert.alert('Location capture failed', message);
    } finally {
      setCapturingLocation(false);
    }
  };

  const registerOrchard = async () => {
    if (
      !orchardName.trim() ||
      !orchardType.trim() ||
      !addressLine1.trim() ||
      !district.trim() ||
      !state.trim() ||
      !pincode.trim() ||
      !numberOfTrees.trim() ||
      !gpsPolygon
    ) {
      Alert.alert(
        'Required fields missing',
        'Orchard name, orchard type, address, district, state, pincode, tree count, and perimeter are required.',
      );
      return;
    }

    setSaving(true);
    setNdviInfo(null);

    try {
      const formData = new FormData();
      formData.append('orchardName', orchardName.trim());
      formData.append('orchardType', orchardType.trim());
      formData.append('addressLine1', addressLine1.trim());
      formData.append('addressLine2', addressLine2.trim());
      formData.append('village', village.trim());
      formData.append('city', city.trim());
      formData.append('district', district.trim());
      formData.append('state', state.trim());
      formData.append('pincode', pincode.trim());
      formData.append('landmark', landmark.trim());
      formData.append('areaAcres', areaAcres.trim());
      formData.append('numberOfTrees', numberOfTrees.trim());
      formData.append('treeTypes', JSON.stringify(selectedTreeTypes));
      formData.append('gpsPolygon', JSON.stringify(gpsPolygon));

      documents.forEach((document, index) => {
        formData.append('documents', {
          uri: document.uri,
          name: document.name || `orchard-document-${index + 1}`,
          type: document.mimeType || 'application/octet-stream',
        } as never);
      });

      const response = await apiRequest<OrchardSubmitResponse>(
        '/api/farms/register-orchard',
        {
          method: 'POST',
          body: formData,
        },
        token,
      );

      const validationText = response.orchardRegistration?.locationValidated
        ? `Validated with NDVI score ${response.orchardRegistration.ndviScore ?? response.orchardRegistration.locationValidationScore}`
        : 'Registration saved. Validation is pending.';

      setNdviInfo(validationText);
      Alert.alert('Orchard registered', response.message);

      await refreshUser();
      router.replace('/(tabs)');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request failed';
      Alert.alert('Registration failed', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageWrapper>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Orchard Registration</Text>

        <Card>
          <CardHeader>
            <CardTitle>Register the orchard and validate the location</CardTitle>
          </CardHeader>
          <CardContent style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Orchard name"
              value={orchardName}
              onChangeText={setOrchardName}
            />
            <TextInput
              style={styles.input}
              placeholder="Orchard type"
              value={orchardType}
              onChangeText={setOrchardType}
            />
            <TextInput
              style={styles.input}
              placeholder="Address line 1"
              value={addressLine1}
              onChangeText={setAddressLine1}
            />
            <TextInput
              style={styles.input}
              placeholder="Address line 2"
              value={addressLine2}
              onChangeText={setAddressLine2}
            />
            <TextInput
              style={styles.input}
              placeholder="Village / Area"
              value={village}
              onChangeText={setVillage}
            />
            <TextInput style={styles.input} placeholder="City" value={city} onChangeText={setCity} />
            <TextInput style={styles.input} placeholder="District" value={district} onChangeText={setDistrict} />
            <TextInput style={styles.input} placeholder="State" value={state} onChangeText={setState} />
            <TextInput
              style={styles.input}
              placeholder="Pincode"
              value={pincode}
              onChangeText={setPincode}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Landmark"
              value={landmark}
              onChangeText={setLandmark}
            />
            <TextInput
              style={styles.input}
              placeholder="Area in acres"
              value={areaAcres}
              onChangeText={setAreaAcres}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Number of trees"
              value={numberOfTrees}
              onChangeText={setNumberOfTrees}
              keyboardType="numeric"
            />

            <View>
              <Text style={styles.sectionLabel}>Tree types</Text>
              <Text style={styles.helperText}>{treeSummary}</Text>
              <View style={styles.treeGrid}>
                {treeOptions.map((treeType) => {
                  const selected = selectedTreeTypes.includes(treeType);
                  return (
                    <TouchableOpacity
                      key={treeType}
                      style={[styles.treeChip, selected && styles.treeChipSelected]}
                      onPress={() => toggleTreeType(treeType)}>
                      <Text style={[styles.treeChipText, selected && styles.treeChipTextSelected]}>{treeType}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View>
              <Text style={styles.sectionLabel}>Orchard perimeter</Text>
              <Button onPress={captureOrchardPerimeter} disabled={saving || capturingLocation}>
                <Text style={styles.btnText}>{capturingLocation ? 'Capturing...' : 'Capture perimeter from location'}</Text>
              </Button>
              <Text style={styles.helperText}>
                {gpsPolygon
                  ? 'Perimeter captured successfully from Expo Location API.'
                  : 'Use current device location to save the orchard GPS polygon.'}
              </Text>
            </View>

            <View>
              <Text style={styles.sectionLabel}>Registration documents</Text>
              <Button onPress={pickDocuments} disabled={saving}>
                <Text style={styles.btnText}>Upload documents</Text>
              </Button>
              {documents.length ? (
                <View style={styles.documentList}>
                  {documents.map((document) => (
                    <View key={document.uri} style={styles.documentRow}>
                      <View style={styles.documentHeader}>
                        <Text style={styles.documentName}>{document.name}</Text>
                        <TouchableOpacity
                          onPress={() =>
                            setDocuments((current) => current.filter((item) => item.uri !== document.uri))
                          }
                          style={styles.removeButton}
                        >
                          <Text style={styles.removeButtonText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                      {document.mimeType?.startsWith('image/') ? (
                        <Image source={{ uri: document.uri }} style={styles.preview} />
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.helperText}>You can attach land records, title deeds, or certificates.</Text>
              )}
            </View>

            <Button onPress={registerOrchard} disabled={saving}>
              <Text style={styles.btnText}>{saving ? 'Saving...' : 'Register Orchard'}</Text>
            </Button>

            {ndviInfo ? <Text style={styles.ndviInfo}>{ndviInfo}</Text> : null}
          </CardContent>
        </Card>
      </ScrollView>
    </PageWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  form: {
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: '#f9fafb',
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  helperText: {
    color: '#6b7280',
    marginBottom: 10,
  },
  treeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
  },
  treeChip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#fff',
  },
  treeChipSelected: {
    backgroundColor: '#14532d',
    borderColor: '#14532d',
  },
  treeChipText: {
    color: '#111827',
    fontWeight: '600',
  },
  treeChipTextSelected: {
    color: '#fff',
  },
  documentList: {
    gap: 10,
    marginTop: 10,
  },
  documentRow: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fafafa',
    gap: 8,
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  documentName: {
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  removeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fee2e2',
  },
  removeButtonText: {
    color: '#991b1b',
    fontWeight: '700',
    fontSize: 12,
  },
  preview: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
  },
  ndviInfo: {
    marginTop: 8,
    color: '#065f46',
    fontWeight: '600',
  },
});
