import { NextRequest, NextResponse } from 'next/server';
import { getIPAssetById } from '@/services/storyProtocolAPI';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ipId: string }> }
) {
  try {
    const { ipId } = await params;
    
    if (!ipId) {
      return NextResponse.json(
        { error: 'IP ID is required' },
        { status: 400 }
      );
    }

    // Fetch IP asset data from Story Protocol API
    console.log(`🔍 Fetching metadata for IP ID: ${ipId}`);
    const ipAsset = await getIPAssetById(ipId);
    
    if (!ipAsset) {
      console.log(`❌ IP Asset not found: ${ipId}`);
      // Return mock data for development instead of 404
      const mockData = {
        ipId: ipId,
        name: 'Mock IP Asset',
        description: 'This is a mock IP asset for development purposes',
        image: '/placeholder-ip.png',
        thumbnail: '/placeholder-ip.png',
        category: 'IP Asset',
        owner: '0x0000000000000000000000000000000000000000',
        tokenId: '1',
        collection: {
          name: 'Mock Collection',
          slug: 'mock-collection',
          bannerImageUrl: '/placeholder-banner.png'
        },
        attributes: [],
        licenseTerms: null,
        createdAt: new Date().toISOString(),
        registrationDate: new Date().toISOString(),
        uri: `https://example.com/ip/${ipId}`,
        metadataUri: `https://example.com/metadata/${ipId}`,
        animation: null,
        externalUrl: null
      };
      
      return NextResponse.json(mockData);
    }

    // Format metadata for frontend consumption
    const metadata = {
      ipId: ipAsset.ipId,
      name: ipAsset.name || ipAsset.title || 'Untitled IP Asset',
      description: ipAsset.description || 'No description available',
      image: ipAsset.nftMetadata?.image?.cachedUrl || ipAsset.nftMetadata?.image?.originalUrl || '/placeholder-ip.png',
      thumbnail: ipAsset.nftMetadata?.image?.thumbnailUrl || ipAsset.nftMetadata?.image?.cachedUrl || '/placeholder-ip.png',
      category: 'IP Asset', // Can be derived from metadata attributes
      owner: ipAsset.ownerAddress,
      tokenId: ipAsset.tokenId,
      collection: {
        name: ipAsset.nftMetadata?.collection?.name || 'Unknown Collection',
        slug: ipAsset.nftMetadata?.collection?.slug || 'unknown',
        bannerImageUrl: ipAsset.nftMetadata?.collection?.bannerImageUrl || '/placeholder-banner.png'
      },
      attributes: (ipAsset.nftMetadata as any)?.raw?.attributes || [],
      licenseTerms: ipAsset.licenses?.[0]?.terms || null,
      createdAt: ipAsset.createdAt,
      registrationDate: ipAsset.registrationDate,
      uri: ipAsset.uri,
      metadataUri: ipAsset.ipaMetadataUri,
      // Additional visual metadata
      animation: (ipAsset.nftMetadata as any)?.animation || null,
      externalUrl: (ipAsset.nftMetadata?.collection as any)?.externalUrl || null
    };

    // Cache the response for 5 minutes
    const response = NextResponse.json(metadata);
    response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    
    return response;
    
  } catch (error) {
    console.error('Error fetching IP asset metadata:', error);
    return NextResponse.json(
      { error: 'Failed to fetch IP asset metadata' },
      { status: 500 }
    );
  }
}
